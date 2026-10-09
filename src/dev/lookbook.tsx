// Dev-only page (not part of the production build): renders outfits for visual inspection.
// Open /lookbook.html?angle=0..3&walk=1
import { useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Character from '../components/three/RiggedCharacter';
import type { CharacterLook } from '../types/investigation';
import type { MotionState } from '../components/three/Humanoid';

const params = new URLSearchParams(location.search);
const angle = Number(params.get('angle') ?? 0) * (Math.PI / 2);
const walk = params.get('walk') === '1';
const zoom = params.get('zoom') === '1';

const base = { skin: '#e5b48f', hairColor: '#3b2618', pantsColor: '#2d3440', topColor: '#d9dde3' };
const looks: CharacterLook[] = [
  { ...base, body: 'male', hairStyle: 'short', outfit: 'tshirt', topColor: '#3d6b8a' },
  { ...base, body: 'male', hairStyle: 'short', outfit: 'leather', topColor: '#4a3426', pantsColor: '#24324a' },
  { ...base, body: 'female', hairStyle: 'bun', outfit: 'uniform', topColor: '#8fb0d4', pantsColor: '#1d2633' },
  { ...base, body: 'male', hairStyle: 'buzz', outfit: 'suit', topColor: '#2d3440', skin: '#9c6644' },
  { ...base, body: 'female', hairStyle: 'long', outfit: 'labcoat', topColor: '#f1f3f5', skin: '#f3d2b3' },
  { ...base, body: 'male', hairStyle: 'bald', outfit: 'apron', topColor: '#8a3b2e', beard: true },
]

function Row() {
  const motion = useRef<MotionState>({ speed: walk ? 0.3 : 0 });
  const group = useRef<THREE.Group>(null);
  useFrame(() => group.current && (group.current.rotation.y = angle));
  return (
    <>
      {looks.map((look, i) => (
        <group key={i} position={[(i - 2.5) * 0.95, 0, 0]} rotation={[0, angle, 0]}>
          <Character look={look} motion={motion} />
        </group>
      ))}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div style={{ width: '100vw', height: '100vh' }}>
    <Canvas camera={{ position: zoom ? [0, 1.25, 2.6] : [0, 1.1, 6.6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, zoom ? 1.1 : 0.95, 0)}>
      <color attach="background" args={['#9aa3ad']} />
      <hemisphereLight args={['#ffffff', '#666666', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={2.5} />
      <Row />
    </Canvas>
  </div>,
);
