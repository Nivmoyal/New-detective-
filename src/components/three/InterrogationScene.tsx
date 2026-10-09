import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CharacterLook } from '../../types/investigation';
import Humanoid, { type Mood } from './Humanoid';
import { textures } from './textures';

interface Props {
  suspect: CharacterLook;
  detective: CharacterLook;
  tension: number;
  mood: Mood;
  talking: boolean;
  className?: string;
}

function Lamp({ tension }: { tension: number }) {
  const light = useRef<THREE.SpotLight>(null);
  const shade = useRef<THREE.Group>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sway = Math.sin(t * 0.9) * 0.04 * (0.4 + tension / 100);
    if (shade.current) shade.current.rotation.z = sway;
    if (light.current) {
      // the bulb flickers more as the room heats up
      const flicker = tension > 70 && Math.random() < 0.04 ? 0.6 : 1;
      light.current.intensity = 60 * flicker;
    }
  });
  return (
    <group ref={shade} position={[0, 2.6, 0]}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.7]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.28, 0.22, 24, 1, true]} />
        <meshStandardMaterial color="#2b2f36" metalness={0.6} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <sphereGeometry args={[0.06, 12, 10]} />
        <meshStandardMaterial color="#fff6dd" emissive="#ffe2a8" emissiveIntensity={3} />
      </mesh>
      <spotLight
        ref={light}
        position={[0, -0.05, 0]}
        angle={0.75}
        penumbra={0.55}
        distance={8}
        decay={1.4}
        color="#ffe6b8"
        castShadow
        shadow-mapSize={[1024, 1024]}
        target={target}
      />
      <primitive object={target} position={[0, -2.6, 0]} />
    </group>
  );
}

function Room() {
  const wall = textures.plaster();
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial map={textures.lino()} color="#6f757d" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.6, -1.9]} receiveShadow>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial map={wall} color="#7c8590" roughness={0.9} />
      </mesh>
      {/* one-way mirror */}
      <mesh position={[1.4, 1.6, -1.88]}>
        <planeGeometry args={[1.6, 0.9]} />
        <meshStandardMaterial color="#0c1118" metalness={0.9} roughness={0.08} />
      </mesh>
      {/* table */}
      <mesh position={[0, 0.76, 0.15]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.05, 0.9]} />
        <meshStandardMaterial color="#5a5e66" metalness={0.5} roughness={0.35} />
      </mesh>
      {[
        [-0.72, -0.25],
        [0.72, -0.25],
        [-0.72, 0.55],
        [0.72, 0.55],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.38, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.76]} />
          <meshStandardMaterial color="#3a3e45" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {/* case folder and recorder on the table */}
      <mesh position={[0.35, 0.8, 0.35]} rotation={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.32, 0.02, 0.42]} />
        <meshStandardMaterial color="#c9a227" roughness={0.8} />
      </mesh>
      <mesh position={[-0.45, 0.81, 0.3]} castShadow>
        <boxGeometry args={[0.16, 0.05, 0.1]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[-0.4, 0.84, 0.3]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={4} />
      </mesh>
      {/* suspect chair */}
      <mesh position={[0, 0.45, -0.55]} castShadow>
        <boxGeometry args={[0.45, 0.05, 0.45]} />
        <meshStandardMaterial color="#1f2329" />
      </mesh>
      <mesh position={[0, 0.8, -0.78]} castShadow>
        <boxGeometry args={[0.45, 0.65, 0.04]} />
        <meshStandardMaterial color="#1f2329" />
      </mesh>
    </>
  );
}

function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.camera.position.set(0.5 + Math.sin(t * 0.2) * 0.05, 1.5, 1.85);
    state.camera.lookAt(-0.05, 1.12, -0.55);
  });
  return null;
}

export default function InterrogationScene({ suspect, detective, tension, mood, talking, className }: Props) {
  return (
    <div className={className}>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 38, near: 0.05, far: 30 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={['#07090c']} />
        <fog attach="fog" args={['#07090c', 3, 8]} />
        <hemisphereLight args={['#3b4658', '#0b0b0b', 0.35]} />
        <Room />
        <Lamp tension={tension} />
        <group position={[0, 0, -0.55]}>
          <Humanoid look={suspect} pose="sit" mood={mood} fidget={tension / 100} talking={talking} />
        </group>
        {/* the detective, back to the camera */}
        <group position={[-0.45, 0, 0.95]} rotation={[0, Math.PI - 0.25, 0]}>
          <Humanoid look={detective} pose="sit" mood="neutral" />
        </group>
        <CameraRig />
      </Canvas>
    </div>
  );
}
