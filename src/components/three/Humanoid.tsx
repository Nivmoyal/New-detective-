import { forwardRef, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CharacterLook } from '../../types/investigation';

/** Shared motion channel: the controller writes, the rig reads every frame. */
export interface MotionState {
  speed: number; // 0..1 normalized walking speed
}

export type Pose = 'stand' | 'sit';
export type Mood = 'neutral' | 'tense' | 'defiant' | 'broken';

interface Props {
  look: CharacterLook;
  motion?: MutableRefObject<MotionState>;
  talking?: boolean;
  pose?: Pose;
  mood?: Mood;
  /** 0..1, drives fidgeting (interrogation tension). */
  fidget?: number;
  seed?: number;
  castShadow?: boolean;
}

/* ------------------------------------------------------------------ */
/* Shared geometry                                                     */
/* ------------------------------------------------------------------ */

const G = {
  upperLeg: new THREE.CapsuleGeometry(0.078, 0.3, 6, 12),
  lowerLeg: new THREE.CapsuleGeometry(0.064, 0.3, 6, 12),
  shoe: new THREE.BoxGeometry(0.11, 0.08, 0.25),
  pelvis: new THREE.CapsuleGeometry(0.15, 0.08, 6, 14),
  chest: new THREE.CapsuleGeometry(0.165, 0.28, 8, 16),
  upperArm: new THREE.CapsuleGeometry(0.056, 0.22, 6, 10),
  foreArm: new THREE.CapsuleGeometry(0.048, 0.2, 6, 10),
  hand: new THREE.SphereGeometry(0.052, 12, 10),
  neck: new THREE.CylinderGeometry(0.052, 0.06, 0.12, 12),
  head: new THREE.SphereGeometry(0.112, 24, 20),
  ear: new THREE.SphereGeometry(0.026, 8, 8),
  nose: new THREE.ConeGeometry(0.02, 0.05, 8),
  eye: new THREE.SphereGeometry(0.014, 10, 8),
  eyeWhite: new THREE.SphereGeometry(0.021, 10, 8),
  brow: new THREE.BoxGeometry(0.045, 0.009, 0.012),
  mouth: new THREE.BoxGeometry(0.05, 0.008, 0.01),
  hairCap: new THREE.SphereGeometry(0.122, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
  hairBack: new THREE.SphereGeometry(0.12, 20, 14, Math.PI * 0.85, Math.PI * 1.3, Math.PI * 0.2, Math.PI * 0.5),
  curl: new THREE.SphereGeometry(0.045, 10, 8),
  bun: new THREE.SphereGeometry(0.055, 14, 12),
  pony: new THREE.CapsuleGeometry(0.035, 0.16, 6, 10),
  longBack: new THREE.BoxGeometry(0.22, 0.32, 0.06),
  beard: new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI, Math.PI * 0.45, Math.PI * 0.4),
  lens: new THREE.TorusGeometry(0.026, 0.005, 6, 16),
  bridge: new THREE.BoxGeometry(0.03, 0.005, 0.005),
  capTop: new THREE.CylinderGeometry(0.125, 0.12, 0.07, 20),
  capVisor: new THREE.BoxGeometry(0.17, 0.012, 0.09),
  coatSkirt: new THREE.CylinderGeometry(0.2, 0.25, 0.5, 18, 1, true),
  collar: new THREE.TorusGeometry(0.085, 0.022, 8, 18, Math.PI * 1.4),
  hood: new THREE.SphereGeometry(0.13, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4),
  shirtFront: new THREE.BoxGeometry(0.1, 0.3, 0.02),
  tie: new THREE.BoxGeometry(0.035, 0.24, 0.015),
  badge: new THREE.BoxGeometry(0.04, 0.05, 0.01),
  epaulette: new THREE.BoxGeometry(0.09, 0.015, 0.06),
  apron: new THREE.BoxGeometry(0.3, 0.55, 0.02),
  vest: new THREE.CapsuleGeometry(0.172, 0.26, 8, 16),
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, roughness = 0.8, metalness = 0, emissive?: string): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ''}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.35;
    }
    matCache.set(key, m);
  }
  return m;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

export const Humanoid = forwardRef<THREE.Group, Props>(function Humanoid(
  { look, motion, talking = false, pose = 'stand', mood = 'neutral', fidget = 0, seed = 0, castShadow = true },
  ref,
) {
  const female = look.body === 'female';
  const scale = (look.height ?? 1) * (female ? 0.95 : 1);
  const shoulderX = female ? 0.2 : 0.235;
  const chestScale: [number, number, number] = female ? [1.08, 1, 0.74] : [1.24, 1, 0.78];
  const limb = female ? 0.9 : 1;

  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const lLeg = useRef<THREE.Group>(null);
  const rLeg = useRef<THREE.Group>(null);
  const lKnee = useRef<THREE.Group>(null);
  const rKnee = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null);
  const rArm = useRef<THREE.Group>(null);
  const lElbow = useRef<THREE.Group>(null);
  const rElbow = useRef<THREE.Group>(null);
  const phase = useRef(seed * 1.7);

  const m = useMemo(() => {
    const outfit = look.outfit;
    const top = look.topColor;
    const isCoat = outfit === 'labcoat';
    const sleeve =
      outfit === 'blazer' || outfit === 'suit' || outfit === 'leather' || outfit === 'hoodie' || isCoat || outfit === 'uniform'
        ? top
        : outfit === 'vest'
          ? '#2d3440'
          : outfit === 'apron'
            ? '#9aa3ad'
            : top;
    const chest = outfit === 'apron' ? '#9aa3ad' : outfit === 'vest' ? '#2d3440' : top;
    const leather = outfit === 'leather';
    return {
      skin: mat(look.skin, 0.62),
      lips: mat(shade(look.skin, -0.14), 0.55),
      hair: mat(look.hairColor, 0.72),
      eye: mat('#14100d', 0.2),
      eyeWhite: mat('#eeeae4', 0.4),
      chest: mat(chest, leather ? 0.42 : 0.88, leather ? 0.08 : 0),
      sleeve: mat(sleeve, leather ? 0.42 : 0.88, leather ? 0.08 : 0),
      foreSleeve: outfit === 'tshirt' || outfit === 'apron' || outfit === 'vest' ? mat(look.skin, 0.62) : mat(sleeve, leather ? 0.42 : 0.88),
      pants: mat(look.pantsColor, 0.86),
      shoe: mat('#121214', 0.38, 0.1),
      shirt: mat('#e9ecef', 0.7),
      tie: mat('#5e1f26', 0.6),
      gold: mat('#d4a017', 0.3, 0.8),
      dark: mat('#1b2433', 0.7),
      apron: mat(top, 0.8),
      vest: mat(top, 0.65, 0, top),
      glasses: mat('#0e0f12', 0.25, 0.6),
      cap: mat(look.outfit === 'uniform' ? '#1b2433' : shade(look.topColor, -0.1), 0.7),
    };
  }, [look]);

  const shadow = castShadow;

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime + seed * 3.1;
    const speed = motion ? motion.current.speed : 0;
    phase.current += dt * (4 + 6.5 * speed) * (speed > 0.02 ? 1 : 0);
    const p = phase.current;
    const tension = fidget;

    if (pose === 'sit') {
      if (hips.current) hips.current.position.y = 0.5;
      if (lLeg.current) lLeg.current.rotation.set(-Math.PI / 2 + 0.08, 0, 0.05);
      if (rLeg.current) rLeg.current.rotation.set(-Math.PI / 2 + 0.08, 0, -0.05);
      const tap = tension > 0.5 ? Math.max(0, Math.sin(t * 14)) * 0.12 * tension : 0;
      if (lKnee.current) lKnee.current.rotation.x = Math.PI / 2 - 0.1 + tap;
      if (rKnee.current) rKnee.current.rotation.x = Math.PI / 2 - 0.1;
      let shX = -0.85;
      let shZ = 0.18;
      let elX = -0.75;
      let lean = 0.08;
      let headX = 0;
      let headY = Math.sin(t * 0.7) * 0.15;
      if (mood === 'defiant') {
        shX = -0.55;
        shZ = 0.75;
        elX = -2.0;
        lean = -0.12;
        headX = -0.12;
      } else if (mood === 'broken') {
        lean = 0.32;
        headX = 0.55;
        headY = 0;
      } else if (mood === 'tense') {
        lean = 0.15;
        headY = Math.sin(t * (2 + tension * 5)) * 0.2 * (0.4 + tension);
      }
      if (lArm.current) lArm.current.rotation.set(shX, 0, shZ);
      if (rArm.current) rArm.current.rotation.set(shX, 0, -shZ);
      const hand = Math.sin(t * (3 + tension * 8)) * 0.08 * tension;
      if (lElbow.current) lElbow.current.rotation.set(elX + hand, 0, 0);
      if (rElbow.current) rElbow.current.rotation.set(elX - hand, 0, 0);
      if (torso.current) {
        torso.current.rotation.x = lean;
        torso.current.scale.y = 1 + Math.sin(t * (1.6 + tension * 3)) * 0.012;
      }
      if (head.current) {
        head.current.rotation.x = headX + (talking ? Math.sin(t * 7) * 0.05 : 0);
        head.current.rotation.y = headY;
      }
      return;
    }

    // ---- standing / walking
    const swing = 0.62 * speed;
    if (hips.current) {
      hips.current.position.y = 0.92 + Math.abs(Math.sin(p)) * 0.035 * speed;
      hips.current.rotation.y = Math.sin(p) * 0.08 * speed;
    }
    if (lLeg.current) lLeg.current.rotation.set(-Math.sin(p) * swing, 0, 0.02);
    if (rLeg.current) rLeg.current.rotation.set(Math.sin(p) * swing, 0, -0.02);
    if (lKnee.current) lKnee.current.rotation.x = (0.08 + Math.max(0, Math.sin(p + 1.4)) * 0.85) * speed + 0.03;
    if (rKnee.current) rKnee.current.rotation.x = (0.08 + Math.max(0, Math.sin(p + 1.4 + Math.PI)) * 0.85) * speed + 0.03;

    const idle = 1 - speed;
    const breathe = Math.sin(t * 1.8) * 0.012 * idle;
    const gesture = talking ? Math.sin(t * 3.2) * 0.25 : 0;
    if (lArm.current) lArm.current.rotation.set(Math.sin(p) * 0.55 * speed + breathe - gesture * 0.6, 0, 0.09 + idle * 0.02);
    if (rArm.current)
      rArm.current.rotation.set(-Math.sin(p) * 0.55 * speed + breathe + (talking ? -0.35 + gesture : 0), 0, -0.09 - idle * 0.02);
    if (lElbow.current) lElbow.current.rotation.set(-0.18 - 0.35 * speed - (talking ? 0.3 : 0), 0, 0);
    if (rElbow.current) rElbow.current.rotation.set(-0.18 - 0.35 * speed - (talking ? 0.8 + gesture : 0), 0, 0);
    if (torso.current) {
      torso.current.rotation.x = 0.04 * speed;
      torso.current.rotation.y = -Math.sin(p) * 0.06 * speed;
      torso.current.scale.y = 1 + breathe;
    }
    if (head.current) {
      head.current.rotation.x = talking ? Math.sin(t * 6.5) * 0.06 : Math.sin(t * 0.5) * 0.02;
      head.current.rotation.y = idle * Math.sin(t * 0.37 + seed) * 0.22;
    }
  });

  const longHair = look.hairStyle === 'long';
  const skirt = look.outfit === 'labcoat';

  return (
    <group ref={ref} scale={scale}>
      <group ref={hips} position={[0, 0.92, 0]}>
        {/* pelvis */}
        <mesh geometry={G.pelvis} material={m.pants} rotation={[0, 0, Math.PI / 2]} scale={[1, female ? 1.08 : 1, 0.72]} castShadow={shadow} />

        {/* legs */}
        {[
          [lLeg, lKnee, 1],
          [rLeg, rKnee, -1],
        ].map(([legRef, kneeRef, side]) => (
          <group key={side as number} ref={legRef as React.RefObject<THREE.Group>} position={[(side as number) * 0.095, -0.04, 0]}>
            <mesh geometry={G.upperLeg} material={m.pants} position={[0, -0.2, 0]} scale={[limb, 1, limb]} castShadow={shadow} />
            <group ref={kneeRef as React.RefObject<THREE.Group>} position={[0, -0.42, 0]}>
              <mesh geometry={G.lowerLeg} material={m.pants} position={[0, -0.19, 0]} scale={[limb, 1, limb]} castShadow={shadow} />
              <mesh geometry={G.shoe} material={m.shoe} position={[0, -0.42, 0.045]} castShadow={shadow} />
            </group>
          </group>
        ))}

        {skirt && <mesh geometry={G.coatSkirt} material={m.chest} position={[0, -0.2, 0]} scale={[1.1, 1, 0.82]} castShadow={shadow} />}

        {/* torso */}
        <group ref={torso} position={[0, 0.06, 0]}>
          <mesh geometry={G.chest} material={m.chest} position={[0, 0.27, 0]} scale={chestScale} castShadow={shadow} />
          {(look.outfit === 'blazer' || look.outfit === 'suit' || look.outfit === 'labcoat') && (
            <mesh geometry={G.shirtFront} material={m.shirt} position={[0, 0.33, 0.127]} />
          )}
          {look.outfit === 'suit' && <mesh geometry={G.tie} material={m.tie} position={[0, 0.32, 0.14]} />}
          {(look.outfit === 'leather' || look.outfit === 'blazer' || look.outfit === 'suit') && (
            <mesh geometry={G.collar} material={m.chest} position={[0, 0.5, 0.005]} rotation={[Math.PI / 2 + 0.25, 0, Math.PI * 0.8]} />
          )}
          {look.outfit === 'hoodie' && <mesh geometry={G.hood} material={m.chest} position={[0, 0.55, -0.07]} scale={[1, 0.8, 1]} />}
          {look.outfit === 'uniform' && (
            <>
              <mesh geometry={G.badge} material={m.gold} position={[-0.09, 0.4, 0.125]} />
              <mesh geometry={G.epaulette} material={m.dark} position={[shoulderX - 0.06, 0.52, 0]} />
              <mesh geometry={G.epaulette} material={m.dark} position={[-shoulderX + 0.06, 0.52, 0]} />
            </>
          )}
          {look.outfit === 'apron' && <mesh geometry={G.apron} material={m.apron} position={[0, 0.12, 0.14]} />}
          {look.outfit === 'vest' && <mesh geometry={G.vest} material={m.vest} position={[0, 0.27, 0]} scale={[chestScale[0] * 1.04, 0.92, chestScale[2] * 1.06]} />}

          {/* arms */}
          {[
            [lArm, lElbow, 1],
            [rArm, rElbow, -1],
          ].map(([armRef, elbowRef, side]) => (
            <group key={side as number} ref={armRef as React.RefObject<THREE.Group>} position={[(side as number) * shoulderX, 0.47, 0]}>
              <mesh geometry={G.upperArm} material={m.sleeve} position={[0, -0.15, 0]} scale={[limb, 1, limb]} castShadow={shadow} />
              <group ref={elbowRef as React.RefObject<THREE.Group>} position={[0, -0.3, 0]}>
                <mesh geometry={G.foreArm} material={m.foreSleeve} position={[0, -0.13, 0]} scale={[limb, 1, limb]} castShadow={shadow} />
                <mesh geometry={G.hand} material={m.skin} position={[0, -0.29, 0.01]} scale={[0.85, 1.1, 0.7]} />
              </group>
            </group>
          ))}

          {/* neck & head */}
          <mesh geometry={G.neck} material={m.skin} position={[0, 0.6, 0]} />
          <group ref={head} position={[0, 0.74, 0.005]}>
            <mesh geometry={G.head} material={m.skin} scale={[0.9, 1.08, 0.98]} castShadow={shadow} />
            <mesh geometry={G.ear} material={m.skin} position={[0.1, 0, -0.005]} scale={[0.5, 1, 0.8]} />
            <mesh geometry={G.ear} material={m.skin} position={[-0.1, 0, -0.005]} scale={[0.5, 1, 0.8]} />
            <mesh geometry={G.nose} material={m.skin} position={[0, -0.005, 0.11]} rotation={[Math.PI / 2 + 0.3, 0, 0]} />
            {[0.038, -0.038].map((x) => (
              <group key={x} position={[x, 0.022, 0.092]}>
                <mesh geometry={G.eyeWhite} material={m.eyeWhite} scale={[1, 0.7, 0.5]} />
                <mesh geometry={G.eye} material={m.eye} position={[0, 0, 0.008]} />
                <mesh geometry={G.brow} material={m.hair} position={[0, 0.03, 0.006]} rotation={[0, 0, x > 0 ? -0.08 : 0.08]} />
              </group>
            ))}
            <mesh geometry={G.mouth} material={m.lips} position={[0, -0.055, 0.098]} />

            {look.hairStyle !== 'bald' && (
              <mesh
                geometry={G.hairCap}
                material={m.hair}
                position={[0, look.hairStyle === 'buzz' ? 0.018 : 0.028, -0.014]}
                rotation={[-0.5, 0, 0]}
                scale={look.hairStyle === 'buzz' ? [0.94, 0.95, 0.98] : [0.98, 1, 1.02]}
              />
            )}
            {look.hairStyle !== 'bald' && look.hairStyle !== 'buzz' && (
              <mesh geometry={G.hairBack} material={m.hair} position={[0, 0, -0.012]} scale={[0.98, 1.02, 1]} />
            )}
            {longHair && <mesh geometry={G.longBack} material={m.hair} position={[0, -0.13, -0.075]} />}
            {look.hairStyle === 'ponytail' && <mesh geometry={G.pony} material={m.hair} position={[0, -0.04, -0.14]} rotation={[0.45, 0, 0]} />}
            {look.hairStyle === 'bun' && <mesh geometry={G.bun} material={m.hair} position={[0, 0.07, -0.1]} />}
            {look.hairStyle === 'curly' &&
              Array.from({ length: 9 }).map((_, i) => {
                const a = (i / 9) * Math.PI * 2;
                return <mesh key={i} geometry={G.curl} material={m.hair} position={[Math.cos(a) * 0.085, 0.085, Math.sin(a) * 0.08 - 0.015]} />;
              })}
            {look.beard && <mesh geometry={G.beard} material={m.hair} position={[0, -0.005, 0.008]} scale={[1, 1.05, 1]} />}
            {look.glasses && (
              <group position={[0, 0.022, 0.108]}>
                <mesh geometry={G.lens} material={m.glasses} position={[0.038, 0, 0]} />
                <mesh geometry={G.lens} material={m.glasses} position={[-0.038, 0, 0]} />
                <mesh geometry={G.bridge} material={m.glasses} />
              </group>
            )}
            {look.cap && (
              <group position={[0, 0.085, 0]}>
                <mesh geometry={G.capTop} material={m.cap} />
                <mesh geometry={G.capVisor} material={m.cap} position={[0, -0.025, 0.11]} rotation={[0.15, 0, 0]} />
                {look.outfit === 'uniform' && <mesh geometry={G.badge} material={m.gold} position={[0, 0.005, 0.124]} scale={0.6} />}
              </group>
            )}
          </group>
        </group>
      </group>
    </group>
  );
});

export default Humanoid;
