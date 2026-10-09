import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GameMap } from '../../types/investigation';
import { WALKABLE_TILES } from '../../data/maps';
import { textures } from './textures';

export const TILE = 1.3;
export const WALL_H = 2.7;

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Floor material for a tile; obstacles take the dominant walkable neighbour. */
function floorChar(map: GameMap, x: number, y: number): string | null {
  const ch = map.tiles[y][x];
  if (ch === '#') return null;
  if (ch === 'D') return map.ambient === 'street' ? '_' : '.';
  if (WALKABLE_TILES.has(ch)) return ch;
  const counts = new Map<string, number>();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ]) {
    const n = map.tiles[y + dy]?.[x + dx];
    if (n && WALKABLE_TILES.has(n) && n !== 'D' && n !== 'F') counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best = map.ambient === 'street' ? '_' : '.';
  let max = 0;
  counts.forEach((c, k) => {
    if (c > max) {
      max = c;
      best = k;
    }
  });
  return best;
}

function floorMaterial(ch: string, ambient: GameMap['ambient']): THREE.MeshStandardMaterial {
  switch (ch) {
    case ',':
      return new THREE.MeshStandardMaterial({ map: textures.asphalt(), roughness: 0.42, metalness: 0.04, color: '#e2e6ec' });
    case '_':
      return new THREE.MeshStandardMaterial({ map: textures.sidewalk(), roughness: 0.82, color: '#b8b2a8' });
    case '=':
      return new THREE.MeshStandardMaterial({ map: textures.carpet(), roughness: 0.95 });
    case 'G':
      return new THREE.MeshStandardMaterial({ map: textures.grass(), roughness: 0.95 });
    case 'F':
      return new THREE.MeshStandardMaterial({ color: '#1a1026', roughness: 0.25, metalness: 0.3 });
    default:
      if (ambient === 'club') return new THREE.MeshStandardMaterial({ map: textures.concrete(), roughness: 0.5, metalness: 0.15, color: '#6f6880' });
      if (ambient === 'street') return new THREE.MeshStandardMaterial({ map: textures.concrete(), roughness: 0.7, color: '#a7a39c' });
      return new THREE.MeshStandardMaterial({ map: textures.lino(), roughness: 0.45, metalness: 0.05 });
  }
}

/* ------------------------------------------------------------------ */
/* Instanced floors                                                    */
/* ------------------------------------------------------------------ */

const floorGeo = new THREE.PlaneGeometry(TILE, TILE).rotateX(-Math.PI / 2);

function Floors({ map }: { map: GameMap }) {
  const groups = useMemo(() => {
    const g = new Map<string, [number, number][]>();
    map.tiles.forEach((row, y) =>
      [...row].forEach((_, x) => {
        const f = floorChar(map, x, y);
        if (!f) return;
        if (!g.has(f)) g.set(f, []);
        g.get(f)!.push([x, y]);
      }),
    );
    return [...g.entries()];
  }, [map]);

  return (
    <>
      {groups.map(([ch, cells]) => (
        <FloorGroup key={ch} ch={ch} cells={cells} ambient={map.ambient} />
      ))}
    </>
  );
}

function FloorGroup({ ch, cells, ambient }: { ch: string; cells: [number, number][]; ambient: GameMap['ambient'] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = useMemo(() => floorMaterial(ch, ambient), [ch, ambient]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    cells.forEach(([x, y], i) => {
      m.makeTranslation((x + 0.5) * TILE, 0, (y + 0.5) * TILE);
      ref.current!.setMatrixAt(i, m);
      if (ch === 'F') c.setHSL(((x + y) % 4) / 4, 0.8, 0.45);
      else c.setScalar(0.88 + hash(x, y) * 0.12);
      ref.current!.setColorAt(i, c);
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [cells, ch]);

  useFrame((state) => {
    if (ch !== 'F' || !ref.current) return;
    const t = state.clock.elapsedTime;
    const c = new THREE.Color();
    cells.forEach(([x, y], i) => {
      const pulse = 0.25 + 0.35 * Math.max(0, Math.sin(t * 3 + x * 0.9 + y * 1.3));
      c.setHSL((t * 0.08 + (x + y) * 0.07) % 1, 0.9, pulse);
      ref.current!.setColorAt(i, c);
    });
    ref.current.instanceColor!.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[floorGeo, material, cells.length]} receiveShadow frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Walls with camera cutaway                                           */
/* ------------------------------------------------------------------ */

const wallGeo = new THREE.BoxGeometry(TILE, WALL_H, TILE).translate(0, WALL_H / 2, 0);

function Walls({ map, focus }: { map: GameMap; focus: MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => {
    const out: [number, number][] = [];
    map.tiles.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && out.push([x, y])));
    return out;
  }, [map]);
  const heights = useMemo(() => new Float32Array(cells.length).fill(1), [cells]);
  const material = useMemo(() => {
    const color = map.ambient === 'station' ? '#d9dade' : map.ambient === 'club' ? '#4a4252' : '#b7a993';
    return new THREE.MeshStandardMaterial({ map: textures.plaster(), color, roughness: 0.9 });
  }, [map.ambient]);

  useLayoutEffect(() => {
    const c = new THREE.Color();
    cells.forEach(([x, y], i) => {
      const v = 0.85 + hash(x, y) * 0.15;
      c.setRGB(v, v, v);
      ref.current!.setColorAt(i, c);
    });
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [cells]);

  const m = useMemo(() => new THREE.Matrix4(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const f = focus.current;
    cells.forEach(([x, y], i) => {
      const wx = (x + 0.5) * TILE;
      const wz = (y + 0.5) * TILE;
      // Walls between the player and the camera (south of the player) drop to a low cutaway.
      const between = wz > f.z - TILE * 0.2 && wz - f.z < TILE * 5 && Math.abs(wx - f.x) < TILE * 7;
      const target = between ? 0.12 : 1;
      heights[i] += (target - heights[i]) * Math.min(1, dt * 8);
      p.set(wx, 0, wz);
      s.set(1, heights[i], 1);
      m.compose(p, q, s);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[wallGeo, material, cells.length]} castShadow receiveShadow frustumCulled={false} />;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 14);
const sphere = new THREE.SphereGeometry(1, 16, 12);

const M = {
  desk: new THREE.MeshStandardMaterial({ map: textures.wood(), roughness: 0.55, color: '#9a7a5c' }),
  laminate: new THREE.MeshStandardMaterial({ color: '#3b4250', roughness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.35, metalness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.5 }),
  screen: new THREE.MeshStandardMaterial({ map: textures.screen(), emissive: '#3b82f6', emissiveIntensity: 0.9, emissiveMap: textures.screen() }),
  paper: new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.9 }),
  cork: new THREE.MeshStandardMaterial({ map: textures.corkPapers(), roughness: 0.9 }),
  crate: new THREE.MeshStandardMaterial({ map: textures.wood(), roughness: 0.8, color: '#b08a5a' }),
  dumpster: new THREE.MeshStandardMaterial({ color: '#2f4a3a', roughness: 0.55, metalness: 0.4 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 0.9 }),
  leaves: new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: '#7a4a32', roughness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({ color: '#9fb6cc', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.6 }),
  tire: new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.8 }),
  lampHead: new THREE.MeshStandardMaterial({ color: '#fff1d6', emissive: '#ffb45c', emissiveIntensity: 2.2 }),
  bar: new THREE.MeshStandardMaterial({ color: '#2a1424', roughness: 0.3, metalness: 0.3 }),
  barTop: new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.25, metalness: 0.2 }),
  neonPink: new THREE.MeshStandardMaterial({ color: '#ff3ea5', emissive: '#ff3ea5', emissiveIntensity: 2 }),
  shelf: new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.6, metalness: 0.3 }),
  carton: new THREE.MeshStandardMaterial({ color: '#a8875e', roughness: 0.9 }),
};

const produceColors = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#8e5a2b', '#d35400'];
const carColors = ['#7a1f1f', '#1f2f4a', '#c7c9cc', '#2b2b2b', '#4a5a3a', '#8a7a5a'];

function Mesh({
  geo = box,
  material,
  position,
  scale,
  rotation,
  shadow = true,
}: {
  geo?: THREE.BufferGeometry;
  material: THREE.Material;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  shadow?: boolean;
}) {
  return <mesh geometry={geo} material={material} position={position} scale={scale} rotation={rotation} castShadow={shadow} receiveShadow />;
}

function Desk({ station }: { station: boolean }) {
  const w = TILE * 0.92;
  return (
    <group>
      <Mesh material={station ? M.laminate : M.desk} position={[0, 0.74, 0]} scale={[w, 0.05, TILE * 0.62]} />
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b]) => (
        <Mesh key={`${a}${b}`} geo={cyl} material={M.metal} position={[(a * w) / 2.3, 0.37, (b * TILE * 0.62) / 2.3]} scale={[0.025, 0.74, 0.025]} shadow={false} />
      ))}
      {station && (
        <>
          <Mesh material={M.dark} position={[0, 0.98, -0.18]} scale={[0.5, 0.32, 0.03]} />
          <mesh geometry={box} material={M.screen} position={[0, 0.98, -0.163]} scale={[0.46, 0.28, 0.005]} />
          <Mesh material={M.dark} position={[0, 0.8, -0.18]} scale={[0.06, 0.08, 0.06]} shadow={false} />
          <Mesh material={M.paper} position={[0.3, 0.775, 0.1]} scale={[0.21, 0.01, 0.29]} rotation={[0, 0.3, 0]} shadow={false} />
        </>
      )}
    </group>
  );
}

function Stall({ length, seed }: { length: number; seed: number }) {
  const w = length * TILE * 0.96;
  const d = TILE * 0.85;
  const awning = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: seed > 0.5 ? textures.awning('#b33a2e', '#e9e2d0') : textures.awning('#d4891e', '#2f5d50'),
        roughness: 0.85,
        side: THREE.DoubleSide,
      }),
    [seed],
  );
  return (
    <group>
      <Mesh material={M.crate} position={[0, 0.42, 0]} scale={[w, 0.84, d]} />
      {Array.from({ length: length * 3 }).map((_, i) => {
        const x = -w / 2 + ((i + 0.5) * w) / (length * 3);
        const color = produceColors[Math.floor(hash(seed * 50 + i, i) * produceColors.length)];
        return (
          <mesh key={i} geometry={sphere} position={[x, 0.93, (hash(i, seed) - 0.5) * 0.3]} scale={[0.17, 0.09, 0.17]} castShadow>
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
        );
      })}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([a, b]) => (
        <Mesh key={`${a}${b}`} geo={cyl} material={M.metal} position={[(a * w) / 2, 1.1, (b * d) / 2]} scale={[0.03, 2.2, 0.03]} shadow={false} />
      ))}
      <mesh geometry={box} material={awning} position={[0, 2.2, 0.1]} rotation={[0.18, 0, 0]} scale={[w + 0.15, 0.03, d + 0.35]} castShadow />
    </group>
  );
}

function Car({ seed, police }: { seed: number; police: boolean }) {
  const color = police ? '#e8ebef' : carColors[Math.floor(seed * carColors.length)];
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.6 }), [color]);
  const bar = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!bar.current) return;
    const on = Math.floor(state.clock.elapsedTime * 4) % 2 === 0;
    (bar.current.children[0] as THREE.Mesh).visible = on;
    (bar.current.children[1] as THREE.Mesh).visible = !on;
  });
  const L = TILE * 1.75;
  return (
    <group rotation={[0, seed > 0.5 ? 0 : Math.PI, 0]}>
      <Mesh material={body} position={[0, 0.5, 0]} scale={[L, 0.5, 0.95]} />
      <Mesh material={body} position={[-0.1, 0.92, 0]} scale={[L * 0.52, 0.38, 0.86]} />
      <Mesh material={M.glass} position={[-0.1, 0.93, 0]} scale={[L * 0.53, 0.3, 0.87]} shadow={false} />
      {police && (
        <>
          <Mesh material={new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.3 })} position={[0, 0.55, 0]} scale={[L * 1.002, 0.12, 0.96]} shadow={false} />
          <group ref={bar} position={[-0.1, 1.15, 0]}>
            <mesh geometry={box} position={[0, 0, 0.18]} scale={[0.22, 0.08, 0.3]}>
              <meshStandardMaterial color="#1e40af" emissive="#3b82f6" emissiveIntensity={4} />
            </mesh>
            <mesh geometry={box} position={[0, 0, -0.18]} scale={[0.22, 0.08, 0.3]}>
              <meshStandardMaterial color="#991b1b" emissive="#ef4444" emissiveIntensity={4} />
            </mesh>
          </group>
        </>
      )}
      {[
        [-0.7, 0.48],
        [0.7, 0.48],
        [-0.7, -0.48],
        [0.7, -0.48],
      ].map(([x, z]) => (
        <Mesh key={`${x}${z}`} geo={cyl} material={M.tire} position={[x, 0.3, z]} rotation={[Math.PI / 2, 0, 0]} scale={[0.3, 0.16, 0.3]} shadow={false} />
      ))}
      <mesh geometry={box} position={[L / 2, 0.55, 0.3]} scale={[0.02, 0.08, 0.18]}>
        <meshStandardMaterial color="#fff" emissive="#fff5d6" emissiveIntensity={1.5} />
      </mesh>
      <mesh geometry={box} position={[L / 2, 0.55, -0.3]} scale={[0.02, 0.08, 0.18]}>
        <meshStandardMaterial color="#fff" emissive="#fff5d6" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

function Tree({ station }: { station: boolean }) {
  if (station)
    return (
      <group>
        <Mesh geo={cyl} material={M.pot} position={[0, 0.25, 0]} scale={[0.25, 0.5, 0.25]} />
        <Mesh geo={sphere} material={M.leaves} position={[0, 0.85, 0]} scale={[0.4, 0.55, 0.4]} />
      </group>
    );
  return (
    <group>
      <Mesh geo={cyl} material={M.trunk} position={[0, 1.2, 0]} scale={[0.12, 2.4, 0.12]} />
      <Mesh geo={sphere} material={M.leaves} position={[0, 2.8, 0]} scale={[1.0, 0.9, 1.0]} />
      <Mesh geo={sphere} material={M.leaves} position={[0.35, 2.4, 0.2]} scale={[0.7, 0.6, 0.7]} />
    </group>
  );
}

function Shelf({ cork }: { cork: boolean }) {
  if (cork)
    return (
      <group>
        <mesh geometry={box} material={M.cork} position={[0, 1.35, 0]} scale={[TILE, 1.1, 0.06]} castShadow />
        <Mesh material={M.metal} position={[0, 0.4, 0]} scale={[TILE, 0.8, 0.05]} />
      </group>
    );
  return (
    <group>
      <Mesh material={M.shelf} position={[0, 1.0, 0]} scale={[TILE * 0.9, 2.0, TILE * 0.55]} />
      {[0.5, 1.1, 1.6].map((y) => (
        <Mesh key={y} material={M.carton} position={[(hash(y, 3) - 0.5) * 0.4, y, 0.05]} scale={[0.45, 0.32, 0.45]} shadow={false} />
      ))}
    </group>
  );
}

function Crates({ street, seed }: { street: boolean; seed: number }) {
  if (street && seed > 0.5)
    return (
      <group>
        <Mesh material={M.dumpster} position={[0, 0.6, 0]} scale={[TILE * 0.9, 1.2, TILE * 0.7]} />
        <Mesh material={M.dark} position={[0, 1.23, 0]} scale={[TILE * 0.92, 0.06, TILE * 0.72]} />
      </group>
    );
  return (
    <group>
      <Mesh material={M.crate} position={[0, 0.3, 0]} scale={[0.75, 0.6, 0.75]} />
      <Mesh material={M.crate} position={[0.15, 0.85, 0.05]} scale={[0.55, 0.5, 0.55]} rotation={[0, 0.4, 0]} />
    </group>
  );
}

function BarCounter({ length }: { length: number }) {
  const w = length * TILE;
  return (
    <group>
      <Mesh material={M.bar} position={[0, 0.55, 0]} scale={[w, 1.1, TILE * 0.6]} />
      <Mesh material={M.barTop} position={[0, 1.12, 0]} scale={[w + 0.05, 0.05, TILE * 0.7]} />
      <mesh geometry={box} material={M.neonPink} position={[0, 0.3, TILE * 0.31]} scale={[w, 0.03, 0.02]} />
      {Array.from({ length: length * 3 }).map((_, i) => (
        <mesh key={i} geometry={cyl} position={[-w / 2 + 0.25 + i * (w / (length * 3)), 1.27, -0.15]} scale={[0.04, 0.26, 0.04]}>
          <meshStandardMaterial color={['#2e7d32', '#8d6e63', '#1565c0', '#f9a825'][i % 4]} roughness={0.1} metalness={0.2} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Lamp() {
  return (
    <group>
      <Mesh geo={cyl} material={M.dark} position={[0, 1.6, 0]} scale={[0.06, 3.2, 0.06]} />
      <Mesh material={M.dark} position={[0, 3.2, 0.3]} scale={[0.06, 0.06, 0.6]} shadow={false} />
      <mesh geometry={box} material={M.lampHead} position={[0, 3.12, 0.55]} scale={[0.28, 0.1, 0.18]} />
    </group>
  );
}

/** Run-length groups of identical horizontally adjacent tiles. */
function runs(map: GameMap, ch: string): { x: number; y: number; len: number }[] {
  const out: { x: number; y: number; len: number }[] = [];
  map.tiles.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === ch) {
        let len = 1;
        while (row[x + len] === ch && len < (ch === 'S' ? 2 : 6)) len++;
        out.push({ x, y, len });
        x += len;
      } else x++;
    }
  });
  return out;
}

function Props({ map }: { map: GameMap }) {
  const items = useMemo(() => {
    const out: { key: string; x: number; y: number; node: JSX.Element }[] = [];
    const station = map.ambient === 'station';
    map.tiles.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const seed = hash(x, y);
        const k = `${ch}-${x}-${y}`;
        if (ch === 'T') out.push({ key: k, x, y, node: <Desk station={station} /> });
        else if (ch === 'C') out.push({ key: k, x, y, node: <Car seed={seed} police={station} /> });
        else if (ch === 'P') out.push({ key: k, x, y, node: <Tree station={station} /> });
        else if (ch === 'B') out.push({ key: k, x, y, node: <Shelf cork={station && y === 5} /> });
        else if (ch === 'X') out.push({ key: k, x, y, node: <Crates street={map.ambient === 'street'} seed={seed} /> });
        else if (ch === 'L') out.push({ key: k, x, y, node: <Lamp /> });
      }),
    );
    for (const r of runs(map, 'S'))
      out.push({ key: `S-${r.x}-${r.y}`, x: r.x + r.len / 2 - 0.5, y: r.y, node: <Stall length={r.len} seed={hash(r.x, r.y)} /> });
    for (const r of runs(map, 'K'))
      out.push({ key: `K-${r.x}-${r.y}`, x: r.x + r.len / 2 - 0.5, y: r.y, node: <BarCounter length={r.len} /> });
    return out;
  }, [map]);

  return (
    <>
      {items.map((it) => (
        <group key={it.key} position={[(it.x + 0.5) * TILE, 0, (it.y + 0.5) * TILE]}>
          {it.node}
        </group>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */

function Lighting({ map }: { map: GameMap }) {
  const w = map.tiles[0].length * TILE;
  const h = map.tiles.length * TILE;
  const lamps = useMemo(() => {
    const out: [number, number][] = [];
    map.tiles.forEach((row, y) => [...row].forEach((ch, x) => ch === 'L' && out.push([x, y])));
    return out.slice(0, 8);
  }, [map]);
  const clubLights = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!clubLights.current) return;
    const t = state.clock.elapsedTime;
    clubLights.current.children.forEach((c, i) => {
      c.position.x = (15 + Math.sin(t * 0.7 + i * 2.1) * 4) * TILE;
      c.position.z = (8 + Math.cos(t * 0.9 + i * 1.7) * 2.5) * TILE;
    });
  });

  const dirRef = useRef<THREE.DirectionalLight>(null);
  useLayoutEffect(() => {
    // The light's target is not part of the scene graph, so update its matrix manually.
    dirRef.current?.target.position.set(w / 2, 0, h / 2);
    dirRef.current?.target.updateMatrixWorld();
  }, [w, h]);

  const dir = (
    <directionalLight
      ref={dirRef}
      position={[w * 0.35, 22, h * 0.9]}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0004}
      shadow-camera-left={-w * 0.75}
      shadow-camera-right={w * 0.75}
      shadow-camera-top={h * 0.75}
      shadow-camera-bottom={-h * 0.75}
      shadow-camera-near={1}
      shadow-camera-far={70}
      intensity={map.ambient === 'station' ? 1.5 : map.ambient === 'club' ? 0.45 : 1.1}
      color={map.ambient === 'station' ? '#fff3e2' : '#a9bbff'}
    />
  );

  return (
    <>
      {map.ambient === 'station' && (
        <>
          <color attach="background" args={['#0b0f15']} />
          <hemisphereLight args={['#e6eefb', '#2b2a28', 1.15]} />
          {map.labels.map((l, i) => (
            <pointLight key={i} position={[l.x * TILE, 2.5, (l.y + 1.6) * TILE]} intensity={9} distance={9} decay={1.6} color="#f4f7ff" />
          ))}
          {lamps.map(([x, y]) => (
            <pointLight key={`${x}-${y}`} position={[(x + 0.5) * TILE, 2.9, (y + 0.5) * TILE + 0.55]} intensity={24} distance={13} decay={1.5} color="#ffd29a" />
          ))}
        </>
      )}
      {map.ambient === 'street' && (
        <>
          <color attach="background" args={['#06080d']} />
          <fog attach="fog" args={['#0a0e16', 20, 50]} />
          <hemisphereLight args={['#5d74a3', '#1a1612', 0.95]} />
          {lamps.map(([x, y]) => (
            <pointLight key={`${x}-${y}`} position={[(x + 0.5) * TILE, 2.9, (y + 0.5) * TILE + 0.55]} intensity={22} distance={13} decay={1.5} color="#ffb066" />
          ))}
        </>
      )}
      {map.ambient === 'club' && (
        <>
          <color attach="background" args={['#06040a']} />
          <fog attach="fog" args={['#0a0610', 14, 40]} />
          <hemisphereLight args={['#4a2c6a', '#050307', 0.45]} />
          <group ref={clubLights}>
            <pointLight intensity={30} distance={12} decay={1.4} color="#ff2fa0" position={[0, 2.6, 0]} />
            <pointLight intensity={30} distance={12} decay={1.4} color="#22d3ee" position={[0, 2.6, 0]} />
            <pointLight intensity={24} distance={12} decay={1.4} color="#a855f7" position={[0, 2.6, 0]} />
          </group>
          <pointLight intensity={14} distance={9} decay={1.5} color="#ff6ab5" position={[3.5 * TILE, 2.4, 11.5 * TILE]} />
          {lamps.map(([x, y]) => (
            <pointLight key={`${x}-${y}`} position={[(x + 0.5) * TILE, 2.9, (y + 0.5) * TILE + 0.55]} intensity={18} distance={12} decay={1.5} color="#ffb066" />
          ))}
        </>
      )}
      {dir}
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function MapScene({ map, focus }: { map: GameMap; focus: MutableRefObject<THREE.Vector3> }) {
  return (
    <>
      <Lighting map={map} />
      <Floors map={map} />
      <Walls map={map} focus={focus} />
      <Props map={map} />
      {map.labels.map((l, i) => (
        <Html key={i} position={[l.x * TILE, WALL_H + 0.35, l.y * TILE]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-slate-200/90" dir="rtl">
            {l.text}
          </div>
        </Html>
      ))}
    </>
  );
}
