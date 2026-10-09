import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { GameMap } from '../../types/investigation';
import { WALKABLE_TILES } from '../../data/maps';
import { assetUrl, useModels } from './loaders';

/*
  Realistic surfaces and architecture built from the tile maps, using PBR textures and facade modules
  from Quaternius' Downtown City MegaKit (CC0). Floors and walls are merged meshes with world-space UVs,
  so textures run continuously across tiles instead of repeating per tile.
*/

export const TILE = 1.3;
export const WALL_H = 2.7;
/** Height of walls on the camera side of a room: a static dollhouse cutaway. */
export const CUTAWAY = 0.32;

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

const TEX = ['concrete', 'marble', 'plaster', 'metal_concrete', 'brick'] as const;

function useSurfaces(ambient: GameMap['ambient']) {
  const urls = useMemo(
    () => [
      ...TEX.flatMap((t) => [`textures/${t}_color.webp`, `textures/${t}_normal.webp`, `textures/${t}_orm.webp`]),
      'textures/asphalt_color.webp',
    ].map(assetUrl),
    [],
  );
  const loaded = useTexture(urls) as THREE.Texture[];
  return useMemo(() => {
    loaded.forEach((t, i) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      // colour maps are sRGB, normal/ORM data is linear
      t.colorSpace = i % 3 === 0 || i === loaded.length - 1 ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.needsUpdate = true;
    });
    const set = (name: (typeof TEX)[number]) => {
      const i = TEX.indexOf(name) * 3;
      return { map: loaded[i], normalMap: loaded[i + 1], roughnessMap: loaded[i + 2], metalnessMap: loaded[i + 2] };
    };
    const asphalt = loaded[loaded.length - 1];
    const night = ambient !== 'station';
    return {
      asphalt: new THREE.MeshStandardMaterial({
        map: asphalt,
        normalMap: set('concrete').normalMap,
        roughnessMap: set('concrete').roughnessMap,
        roughness: night ? 0.75 : 0.9,
        metalness: 0,
        normalScale: new THREE.Vector2(0.6, 0.6),
      }),
      sidewalk: new THREE.MeshStandardMaterial({ ...set('concrete'), metalness: 0, color: '#d9d4cc' }),
      marble: new THREE.MeshStandardMaterial({ ...set('marble'), metalness: 0, roughness: 1, color: '#f1ece4' }),
      concreteFloor: new THREE.MeshStandardMaterial({ ...set('metal_concrete'), metalness: 0, color: ambient === 'club' ? '#6c6476' : '#b9b5ae' }),
      plaster: new THREE.MeshStandardMaterial({ ...set('plaster'), metalness: 0, color: ambient === 'station' ? '#f4f1ea' : ambient === 'club' ? '#7a7086' : '#efe6d4' }),
      brick: new THREE.MeshStandardMaterial({ ...set('brick'), metalness: 0 }),
      cap: new THREE.MeshStandardMaterial({ ...set('concrete'), metalness: 0, color: '#c8c3ba' }),
      curb: new THREE.MeshStandardMaterial({ ...set('concrete'), metalness: 0, color: '#bdb7ad' }),
      backing: new THREE.MeshStandardMaterial({ color: '#2a2d33', roughness: 0.9 }),
    };
  }, [loaded, ambient]);
}

/* ------------------------------------------------------------------ */
/* Geometry builders                                                   */
/* ------------------------------------------------------------------ */

class GeoBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];

  quad(a: number[], b: number[], c: number[], d: number[], n: number[], uvs: number[][]) {
    for (const [p, t] of [
      [a, uvs[0]],
      [b, uvs[1]],
      [c, uvs[2]],
      [a, uvs[0]],
      [c, uvs[2]],
      [d, uvs[3]],
    ] as [number[], number[]][]) {
      this.pos.push(...p);
      this.nrm.push(...n);
      this.uv.push(...t);
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

/** Horizontal quad over a tile with world-space UVs (`scale` metres per texture repeat). */
function floorQuad(b: GeoBuilder, x: number, y: number, scale: number, h = 0) {
  const x0 = x * TILE;
  const x1 = (x + 1) * TILE;
  const z0 = y * TILE;
  const z1 = (y + 1) * TILE;
  const u = (v: number) => v / scale;
  b.quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], [
    [u(x0), u(z0)],
    [u(x0), u(z1)],
    [u(x1), u(z1)],
    [u(x1), u(z0)],
  ]);
}

/** Box sides (only the exposed ones) with world UVs, plus a top. */
function wallBox(sides: GeoBuilder, top: GeoBuilder, map: GameMap, x: number, y: number, h: number, scale: number) {
  const x0 = x * TILE;
  const x1 = (x + 1) * TILE;
  const z0 = y * TILE;
  const z1 = (y + 1) * TILE;
  const open = (dx: number, dy: number) => {
    const t = map.tiles[y + dy]?.[x + dx];
    return t !== undefined && t !== '#';
  };
  const u = (v: number) => v / scale;
  if (open(0, 1)) sides.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], [[u(x0), 0], [u(x1), 0], [u(x1), u(h)], [u(x0), u(h)]]);
  if (open(0, -1)) sides.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], [[u(x1), 0], [u(x0), 0], [u(x0), u(h)], [u(x1), u(h)]]);
  if (open(1, 0)) sides.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], [[u(z1), 0], [u(z0), 0], [u(z0), u(h)], [u(z1), u(h)]]);
  if (open(-1, 0)) sides.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], [[u(z0), 0], [u(z1), 0], [u(z1), u(h)], [u(z0), u(h)]]);
  floorQuad(top, x, y, scale, h);
}

/** Wall tiles whose south face is the street wall seen across the top of a street map. */
function isFacade(map: GameMap, x: number, y: number) {
  if (map.ambient === 'station' || map.tiles[y][x] !== '#') return false;
  const south = map.tiles[y + 1]?.[x];
  return y === 0 && south !== undefined && south !== '#';
}

/* ------------------------------------------------------------------ */
/* Ground and walls                                                    */
/* ------------------------------------------------------------------ */

function floorKind(map: GameMap, x: number, y: number): string | null {
  const ch = map.tiles[y][x];
  if (ch === '#' || ch === 'F') return null;
  if (WALKABLE_TILES.has(ch) && ch !== 'D') return ch;
  // obstacles and doors take the most common walkable neighbour
  const counts = new Map<string, number>();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
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

export function Structure({ map, carpet, grass }: { map: GameMap; carpet: THREE.Material; grass: THREE.Material }) {
  const s = useSurfaces(map.ambient);
  const meshes = useMemo(() => {
    const floors = new Map<string, GeoBuilder>();
    const sidesFull = new GeoBuilder();
    const topFull = new GeoBuilder();
    const sidesLow = new GeoBuilder();
    const topLow = new GeoBuilder();
    const curbs = new GeoBuilder();
    map.tiles.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === '#') {
          if (isFacade(map, x, y)) return;
          const north = map.tiles[y - 1]?.[x];
          const low = north !== undefined && north !== '#';
          if (low) wallBox(sidesLow, topLow, map, x, y, CUTAWAY, 2.6);
          else wallBox(sidesFull, topFull, map, x, y, WALL_H, 2.6);
          return;
        }
        const kind = floorKind(map, x, y);
        if (!kind) return;
        if (!floors.has(kind)) floors.set(kind, new GeoBuilder());
        const scale = kind === ',' ? 7 : kind === '_' ? 2.6 : kind === '.' ? 2.6 : 3;
        // sidewalks sit on a slab above the road
        floorQuad(floors.get(kind)!, x, y, scale, kind === '_' ? 0.06 : 0);
        // curb faces where sidewalk meets road
        if (kind === '_') {
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            const n = map.tiles[y + dy]?.[x + dx];
            if (n !== ',' && n !== 'C') continue;
            const x0 = (x + (dx === 1 ? 1 : 0)) * TILE;
            const z0 = (y + (dy === 1 ? 1 : 0)) * TILE;
            if (dy !== 0) {
              curbs.quad([x * TILE, 0, z0], [(x + 1) * TILE, 0, z0], [(x + 1) * TILE, 0.06, z0], [x * TILE, 0.06, z0], [0, 0, dy], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
            } else {
              curbs.quad([x0, 0, y * TILE], [x0, 0, (y + 1) * TILE], [x0, 0.06, (y + 1) * TILE], [x0, 0.06, y * TILE], [dx, 0, 0], [[0, 0], [1, 0], [1, 0.05], [0, 0.05]]);
            }
          }
        }
      }),
    );
    return {
      floors: [...floors.entries()].map(([k, b]) => [k, b.build()] as const),
      sidesFull: sidesFull.build(),
      topFull: topFull.build(),
      sidesLow: sidesLow.build(),
      topLow: topLow.build(),
      curbs: curbs.build(),
    };
  }, [map]);

  const floorMat = (k: string): THREE.Material => {
    switch (k) {
      case ',':
        return s.asphalt;
      case '_':
        return s.sidewalk;
      case '=':
        return carpet;
      case 'G':
        return grass;
      default:
        if (map.ambient === 'station' || map.id === 'levinsky' || map.id === 'neveShaanan' || map.id === 'shapira') return s.marble;
        return s.concreteFloor;
    }
  };
  const wallMat = map.ambient === 'club' || map.id === 'oldCbs' ? s.brick : s.plaster;

  return (
    <group>
      {meshes.floors.map(([k, g]) => (
        <mesh key={k} geometry={g} material={floorMat(k)} receiveShadow />
      ))}
      <mesh geometry={meshes.curbs} material={s.curb} receiveShadow />
      <mesh geometry={meshes.sidesFull} material={wallMat} castShadow receiveShadow />
      <mesh geometry={meshes.topFull} material={s.cap} receiveShadow />
      <mesh geometry={meshes.sidesLow} material={wallMat} receiveShadow />
      <mesh geometry={meshes.topLow} material={s.cap} receiveShadow />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Street facades and dressing                                         */
/* ------------------------------------------------------------------ */

const KIT = assetUrl('models/city/city_kit.glb');

function useKit() {
  const [kit] = useModels([KIT]);
  return useMemo(() => {
    const get = (name: string) => {
      const o = kit.scene.getObjectByName(name);
      if (!o) return null;
      o.traverse((m) => {
        const mesh = m as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        // lit windows glow faintly at night
        if (/Interior/i.test(mat.name) && mat.map && !mat.emissiveMap) {
          mat.emissive = new THREE.Color('#ffd9a0');
          mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.35;
        }
        if (/Glass/i.test(mat.name)) {
          mat.transparent = true;
          mat.opacity = 0.35;
          mat.roughness = 0.05;
          mat.metalness = 0.6;
        }
      });
      return o;
    };
    return get;
  }, [kit]);
}

function Facades({ map }: { map: GameMap }) {
  const get = useKit();
  const items = useMemo(() => {
    const out: { key: string; obj: THREE.Object3D }[] = [];
    const sx = TILE / 2;
    map.tiles[0].split('').forEach((_, x) => {
      if (!isFacade(map, x, 0)) return;
      const segment = Math.floor(x / 5);
      const floors = 2 + Math.floor(hash(segment, 3) * 2);
      const brick = hash(segment, 9) > 0.65;
      const front = TILE; // south edge of row 0
      const place = (name: string, y: number, extra?: (o: THREE.Object3D) => void) => {
        const src = get(name);
        if (!src) return;
        const o = src.clone();
        o.position.set((x + 0.5) * TILE, y, front);
        o.scale.set(sx, 1, 0.65);
        extra?.(o);
        out.push({ key: `${name}-${x}-${y}`, obj: o });
      };
      const r = hash(x, 1);
      place(r < 0.55 ? 'Trim_FirstFloor_Window_001' : r < 0.75 ? 'Metal_FirstFloor_Window' : 'Trim_FirstFloor_Wall', 0);
      for (let f = 1; f <= floors; f++) {
        place(brick ? 'Brick_Window_Square_Single' : 'Trim_Window', f * 3);
        if (hash(x, f * 7) > 0.72) {
          // the Tel Aviv air-conditioner under the window
          place('Prop_ACUnit', f * 3 + 0.25, (o) => {
            o.position.x += 0.25;
            o.position.z += 0.02;
            o.scale.set(0.6, 0.6, 0.6);
          });
        }
      }
      place('Cornice_Trim_Center', (floors + 1) * 3);
    });
    return out;
  }, [map, get]);

  const backing = useMemo(() => {
    const cols = map.tiles[0].split('').map((_, x) => x).filter((x) => isFacade(map, x, 0));
    return cols.map((x) => ({ x, h: (3 + Math.floor(hash(Math.floor(x / 5), 3) * 2)) * 3 }));
  }, [map]);

  return (
    <group>
      {items.map((i) => (
        <primitive key={i.key} object={i.obj} />
      ))}
      {/* the rest of each building behind its front */}
      {backing.map(({ x, h }) => (
        <mesh key={x} position={[(x + 0.5) * TILE, h / 2, TILE - 0.17 - 1.5]}>
          <boxGeometry args={[TILE, h, 3]} />
          <meshStandardMaterial color="#3a3530" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function StreetDressing({ map }: { map: GameMap }) {
  const get = useKit();
  const items = useMemo(() => {
    const out: { key: string; obj: THREE.Object3D }[] = [];
    const put = (name: string, x: number, y: number, z: number, rot = 0, scale = 1) => {
      const src = get(name);
      if (!src) return;
      const o = src.clone();
      o.position.set(x, y, z);
      o.rotation.y = rot;
      o.scale.setScalar(scale);
      out.push({ key: `${name}-${x.toFixed(2)}-${z.toFixed(2)}`, obj: o });
    };
    map.tiles.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const h = hash(x, y);
        if (ch === ',' && h < 0.035) put(h < 0.02 ? 'Prop_ManholeCover' : 'Prop_Drain', (x + 0.5) * TILE, 0.005, (y + 0.5) * TILE, h * 6, 0.8);
        if (ch === '_') {
          const roadBelow = map.tiles[y + 1]?.[x] === ',';
          const roadAbove = map.tiles[y - 1]?.[x] === ',';
          if ((roadBelow || roadAbove) && x % 3 === 1 && h > 0.35) {
            put('Prop_Bollard', (x + 0.5) * TILE, 0.06, (y + (roadBelow ? 0.88 : 0.12)) * TILE);
          }
        }
      }),
    );
    return out;
  }, [map, get]);

  // zebra crossings and dashed centre lines on the roads
  const markings = useMemo(() => {
    const b = new GeoBuilder();
    const w = map.tiles[0].length;
    for (let y = 0; y < map.tiles.length; y++) {
      const isRoad = (yy: number) => map.tiles[yy]?.split('').filter((c) => c === ',' || c === 'C').length > w * 0.6;
      if (!isRoad(y) || isRoad(y - 1)) continue;
      let y1 = y;
      while (isRoad(y1 + 1)) y1++;
      const z0 = y * TILE;
      const z1 = (y1 + 1) * TILE;
      // centre line
      if (y1 > y) {
        const zc = (z0 + z1) / 2;
        for (let x = 0.4; x < w * TILE; x += 2.2) b.quad([x, 0.004, zc - 0.05], [x, 0.004, zc + 0.05], [x + 1.1, 0.004, zc + 0.05], [x + 1.1, 0.004, zc - 0.05], [0, 1, 0], [[0, 0], [0, 1], [1, 1], [1, 0]]);
      }
      // zebra crossing in the middle of the map
      const cx = Math.floor(w / 2) * TILE;
      for (let i = 0; i < 6; i++) {
        const x = cx - 1.4 + i * 0.55;
        b.quad([x, 0.005, z0 + 0.15], [x, 0.005, z1 - 0.15], [x + 0.3, 0.005, z1 - 0.15], [x + 0.3, 0.005, z0 + 0.15], [0, 1, 0], [[0, 0], [0, 1], [1, 1], [1, 0]]);
      }
    }
    return b.build();
  }, [map]);

  return (
    <group>
      {items.map((i) => (
        <primitive key={i.key} object={i.obj} />
      ))}
      <mesh geometry={markings} receiveShadow>
        <meshStandardMaterial color="#e8e4da" roughness={0.7} transparent opacity={0.85} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  );
}

/** Facades along the top of street maps plus road furniture. */
export function CityDressing({ map }: { map: GameMap }) {
  if (map.ambient === 'station') return null;
  return (
    <>
      <Facades map={map} />
      <StreetDressing map={map} />
    </>
  );
}
