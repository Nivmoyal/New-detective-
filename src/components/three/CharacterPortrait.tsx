import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CharacterLook } from '../../types/investigation';
import { type MotionState } from './Humanoid';
import Humanoid from './RiggedCharacter';

interface Props {
  look: CharacterLook;
  talking?: boolean;
  framing?: 'head' | 'full';
  /** Slowly turn the model (character creator turntable). */
  turntable?: boolean;
  walking?: boolean;
  className?: string;
}

function Rig({ look, talking, framing, turntable, walking }: Required<Omit<Props, 'className'>>) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<MotionState>({ speed: 0 });
  useFrame((state, dt) => {
    motion.current.speed = THREE.MathUtils.lerp(motion.current.speed, walking ? 0.55 : 0, Math.min(1, dt * 4));
    if (group.current) {
      if (turntable) group.current.rotation.y += dt * 0.45;
      else group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.18;
    }
    const h = look.height ?? 1;
    const target = framing === 'head' ? new THREE.Vector3(0, 1.62 * h, 0) : new THREE.Vector3(0, 0.95 * h, 0);
    state.camera.position.set(0, target.y + (framing === 'head' ? 0.02 : 0.15), framing === 'head' ? 0.95 : 4.3);
    state.camera.lookAt(target);
  });
  return (
    <group ref={group}>
      <Humanoid look={look} talking={talking} motion={motion} castShadow />
    </group>
  );
}

export default function CharacterPortrait({ look, talking = false, framing = 'head', turntable = false, walking = false, className }: Props) {
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: framing === 'head' ? 30 : 32, near: 0.05, far: 30 }}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <hemisphereLight args={['#dfe8f5', '#3a2f26', 1.1]} />
        <directionalLight position={[1.6, 2.6, 2.2]} intensity={3.2} color="#ffe8d0" castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2, 1.8, -1.5]} intensity={1.6} color="#5b8cff" />
        <pointLight position={[-1.2, 1.4, 1.6]} intensity={3} color="#ffffff" distance={6} />
        {framing === 'full' && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <circleGeometry args={[1.1, 48]} />
            <meshStandardMaterial color="#1a2230" roughness={0.6} metalness={0.2} />
          </mesh>
        )}
        <Rig look={look} talking={talking} framing={framing} turntable={turntable} walking={walking} />
      </Canvas>
    </div>
  );
}
