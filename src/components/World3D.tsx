import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Compass, Crosshair, DoorOpen, MessageSquare, Search, Video } from 'lucide-react';
import type { CharacterLook, CharacterRef, FacilityHotspot, GameMap, MapHotspot } from '../types/investigation';
import { WALKABLE_TILES, tileAt } from '../data/maps';
import { CHAT_NPCS, FACILITY_CHARACTERS, PEDESTRIANS, type ChatNpc, type Pedestrian } from '../data/characters';
import MapScene, { TILE } from './three/MapScene';
import { type MotionState } from './three/Humanoid';
import Humanoid from './three/RiggedCharacter';

const WALK_MPS = 1.25; // metres per second
const JOG_MPS = 2.9;
const RADIUS = 0.26; // collision radius in tiles
const NPC_RADIUS = 0.5;
const INTERACT_RANGE = 1.5;

type Interactable = {
  id: string;
  kind: 'facility' | 'hotspot' | 'npc';
  x: number;
  y: number;
  facing: number;
  label: string;
  actionLabel: string;
  character?: CharacterRef;
  facility?: FacilityHotspot;
  hotspot?: MapHotspot;
  npc?: ChatNpc;
  visited: boolean;
  caseItem: boolean;
};

interface Props {
  map: GameMap;
  playerLook: CharacterLook;
  hotspots: MapHotspot[];
  visitedHotspotIds: string[];
  startPosition?: { x: number; y: number };
  guideFacilityId?: string | null;
  paused: boolean;
  onFacility: (facility: FacilityHotspot) => void;
  onHotspot: (hotspot: MapHotspot) => void;
  onChat: (npc: ChatNpc) => void;
  onPositionChange: (mapId: string, x: number, y: number) => void;
}

interface Input {
  keys: Set<string>;
  stick: { x: number; y: number };
  target: { x: number; y: number } | null;
}

const toWorld = (x: number, y: number) => new THREE.Vector3(x * TILE, 0, y * TILE);

/* ------------------------------------------------------------------ */
/* Scene actors                                                        */
/* ------------------------------------------------------------------ */

function Marker({ color, height, big = false }: { color: string; height: number; big?: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 1.6;
    ref.current.position.y = height + Math.sin(t * 2.4) * 0.08;
  });
  return (
    <mesh ref={ref} position={[0, height, 0]} scale={big ? 0.2 : 0.14}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} roughness={0.3} />
    </mesh>
  );
}

function FloorRing({ color }: { color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const p = (Math.sin(state.clock.elapsedTime * 3) + 1) / 2;
    ref.current.scale.setScalar(0.9 + p * 0.25);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.55 - p * 0.3;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[0.42, 0.5, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

function EvidenceProp() {
  return (
    <group>
      {/* yellow crime-scene evidence tent */}
      <group position={[0.18, 0, 0.1]}>
        <mesh position={[0, 0.11, 0.05]} rotation={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.24, 0.01]} />
          <meshStandardMaterial color="#f5c518" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.11, -0.05]} rotation={[0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 0.24, 0.01]} />
          <meshStandardMaterial color="#f5c518" roughness={0.6} />
        </mesh>
      </group>
      {/* evidence bag on the floor */}
      <mesh position={[-0.12, 0.025, -0.05]} rotation={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.3]} />
        <meshStandardMaterial color="#d8e3ea" roughness={0.2} transparent opacity={0.85} />
      </mesh>
      <mesh position={[-0.12, 0.05, -0.05]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.24, 0.005, 0.05]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
    </group>
  );
}

function TerminalProp() {
  return (
    <group>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.05, 0.45]} />
        <meshStandardMaterial color="#2b313b" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <boxGeometry args={[0.6, 0.72, 0.35]} />
        <meshStandardMaterial color="#1c2129" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.98, -0.1]} castShadow>
        <boxGeometry args={[0.5, 0.32, 0.03]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0, 0.98, -0.083]}>
        <boxGeometry args={[0.46, 0.28, 0.005]} />
        <meshStandardMaterial color="#0b2540" emissive="#3b82f6" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

/** A character standing in the world who turns to face the detective. */
function Npc({
  item,
  player,
  onTap,
}: {
  item: Interactable;
  player: MutableRefObject<THREE.Vector3>;
  onTap: (item: Interactable) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const near = useRef(false);
  const [talking, setTalking] = useState(false);
  const base = toWorld(item.x, item.y);
  useFrame((_, dt) => {
    if (!group.current) return;
    const dx = player.current.x - base.x;
    const dz = player.current.z - base.z;
    const dist = Math.hypot(dx, dz) / TILE;
    const isNear = dist < 3.2;
    const target = isNear ? Math.atan2(dx, dz) : item.facing;
    let diff = target - group.current.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    group.current.rotation.y += diff * Math.min(1, dt * 4);
    if (isNear !== near.current) {
      near.current = isNear;
      setTalking(isNear && dist < 2);
    }
  });
  const markerColor = item.caseItem ? '#f59e0b' : '#3b82f6';
  return (
    <group
      position={base}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onTap(item);
      }}
    >
      <group ref={group} rotation={[0, item.facing, 0]}>
        <Humanoid look={item.character!.look} talking={talking} seed={item.x * 3 + item.y} />
      </group>
      {!item.visited && <Marker color={markerColor} height={2.25 * (item.character!.look.height ?? 1)} />}
      {!item.visited && <FloorRing color={markerColor} />}
    </group>
  );
}

function PropHotspot({ item, onTap }: { item: Interactable; onTap: (item: Interactable) => void }) {
  const color = item.visited ? '#64748b' : item.caseItem ? '#f59e0b' : '#3b82f6';
  const isTerminal = item.hotspot?.kind === 'cctv';
  return (
    <group
      position={toWorld(item.x, item.y)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onTap(item);
      }}
    >
      {item.kind === 'hotspot' && (isTerminal ? <TerminalProp /> : <EvidenceProp />)}
      {!item.visited && <Marker color={color} height={isTerminal || item.kind === 'facility' ? 1.6 : 0.9} />}
      <FloorRing color={color} />
      {/* soft glow so evidence reads at night */}
      {!item.visited && <pointLight position={[0, 0.6, 0]} intensity={2.5} distance={2.5} color={color} />}
    </group>
  );
}

function Walker({ ped }: { ped: Pedestrian }) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<MotionState>({ speed: 0.55 });
  const state = useRef({ i: 0, t: Math.random() });
  useFrame((_, dt) => {
    if (!group.current) return;
    const s = state.current;
    const a = ped.path[s.i];
    const b = ped.path[(s.i + 1) % ped.path.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    s.t += (dt * ped.speed) / len;
    if (s.t >= 1) {
      s.t = 0;
      s.i = (s.i + 1) % ped.path.length;
    }
    const x = a.x + (b.x - a.x) * s.t;
    const y = a.y + (b.y - a.y) * s.t;
    group.current.position.set(x * TILE, 0, y * TILE);
    group.current.rotation.y = Math.atan2(b.x - a.x, b.y - a.y);
    motion.current.mps = ped.speed * TILE;
    motion.current.speed = Math.min(1, motion.current.mps / JOG_MPS);
  });
  return (
    <group ref={group}>
      <Humanoid look={ped.look} motion={motion} seed={ped.path[0].x} />
    </group>
  );
}

function Beacon({ x, y }: { x: number; y: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(state.clock.elapsedTime * 3) * 0.06;
  });
  return (
    <mesh ref={ref} position={[x * TILE, 3, y * TILE]}>
      <cylinderGeometry args={[0.45, 0.45, 6, 24, 1, true]} />
      <meshBasicMaterial color="#3b82f6" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Player + camera controller                                          */
/* ------------------------------------------------------------------ */

function Player({
  map,
  look,
  start,
  input,
  pausedRef,
  interactables,
  playerWorld,
  guide,
  onNearby,
  onSave,
}: {
  map: GameMap;
  look: CharacterLook;
  start: { x: number; y: number };
  input: MutableRefObject<Input>;
  pausedRef: MutableRefObject<boolean>;
  interactables: MutableRefObject<Interactable[]>;
  playerWorld: MutableRefObject<THREE.Vector3>;
  guide: { x: number; y: number } | null;
  onNearby: (it: Interactable | null) => void;
  onSave: (x: number, y: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const arrow = useRef<THREE.Group>(null);
  const pos = useRef({ ...start });
  const heading = useRef(Math.PI);
  const motion = useRef<MotionState>({ speed: 0, mps: 0 });
  const groundSpeed = useRef(0);
  const nearId = useRef<string | null>(null);
  const saveTimer = useRef(0);
  const camera = useThree((s) => s.camera);
  const camPos = useRef(new THREE.Vector3());
  const firstFrame = useRef(true);

  const blocked = useCallback(
    (x: number, y: number) => {
      const wallHit = [
        [x - RADIUS, y - RADIUS],
        [x + RADIUS, y - RADIUS],
        [x - RADIUS, y + RADIUS],
        [x + RADIUS, y + RADIUS],
      ].some(([cx, cy]) => !WALKABLE_TILES.has(tileAt(map, cx, cy)));
      if (wallHit) return true;
      // People are solid, but never trap the detective: moving away is always allowed.
      const cur = pos.current;
      return interactables.current.some((it) => {
        if (!it.character) return false;
        const d = Math.hypot(it.x - x, it.y - y);
        return d < NPC_RADIUS && d < Math.hypot(it.x - cur.x, it.y - cur.y);
      });
    },
    [map, interactables],
  );

  useEffect(() => () => onSave(pos.current.x, pos.current.y), [onSave]);

  useFrame((state, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const p = pos.current;
    const inp = input.current;

    let ix = 0;
    let iy = 0;
    if (!pausedRef.current) {
      const k = inp.keys;
      if (k.has('arrowleft') || k.has('a')) ix -= 1;
      if (k.has('arrowright') || k.has('d')) ix += 1;
      if (k.has('arrowup') || k.has('w')) iy -= 1;
      if (k.has('arrowdown') || k.has('s')) iy += 1;
      ix += inp.stick.x;
      iy += inp.stick.y;
      if (ix === 0 && iy === 0 && inp.target) {
        const dx = inp.target.x - p.x;
        const dy = inp.target.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.15) inp.target = null;
        else {
          ix = dx / d;
          iy = dy / d;
        }
      }
    }
    const len = Math.min(1, Math.hypot(ix, iy));
    // Gentle push or Shift walks; a full push jogs. Short tap-to-move trips walk.
    const walking = len < 0.6 || inp.keys.has('shift') || (inp.target && Math.hypot(inp.target.x - p.x, inp.target.y - p.y) < 2.5);
    const targetMps = len > 0.05 ? (walking ? WALK_MPS : JOG_MPS) : 0;
    groundSpeed.current = THREE.MathUtils.lerp(groundSpeed.current, targetMps, Math.min(1, dt * (targetMps > groundSpeed.current ? 5 : 9)));
    if (len > 0.05) {
      const nx = ix / Math.hypot(ix, iy);
      const ny = iy / Math.hypot(ix, iy);
      const step = (groundSpeed.current / TILE) * dt;
      let moved = false;
      if (!blocked(p.x + nx * step, p.y)) {
        p.x += nx * step;
        moved = true;
      }
      if (!blocked(p.x, p.y + ny * step)) {
        p.y += ny * step;
        moved = true;
      }
      if (!moved) inp.target = null;
      const want = Math.atan2(nx, ny);
      let diff = want - heading.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      heading.current += diff * Math.min(1, dt * 12);
    }
    motion.current.mps = len > 0.05 ? groundSpeed.current : 0;
    motion.current.speed = Math.min(1, motion.current.mps / JOG_MPS);

    const world = toWorld(p.x, p.y);
    playerWorld.current.copy(world);
    if (group.current) {
      group.current.position.copy(world);
      group.current.rotation.y = heading.current;
    }

    // Guide arrow orbiting the player towards the current objective.
    if (arrow.current) {
      arrow.current.visible = !!guide && Math.hypot(guide.x - p.x, guide.y - p.y) > 2;
      if (guide) {
        arrow.current.position.copy(world);
        arrow.current.rotation.y = Math.atan2(guide.x - p.x, guide.y - p.y);
      }
    }

    // Nearest interactable
    let best: Interactable | null = null;
    let bestD = INTERACT_RANGE;
    for (const it of interactables.current) {
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if ((best?.id ?? null) !== nearId.current) {
      nearId.current = best?.id ?? null;
      onNearby(best);
    }

    saveTimer.current += dt;
    if (saveTimer.current > 2) {
      saveTimer.current = 0;
      onSave(p.x, p.y);
    }

    // Follow camera: high three-quarter view from the south, wider on portrait screens.
    const aspect = state.size.width / state.size.height;
    const back = aspect < 0.8 ? 10.2 : 7.4;
    const up = aspect < 0.8 ? 12.8 : 8.8;
    const desired = new THREE.Vector3(world.x, up, world.z + back);
    if (firstFrame.current) {
      camPos.current.copy(desired);
      firstFrame.current = false;
    } else camPos.current.lerp(desired, Math.min(1, dt * 4));
    camera.position.copy(camPos.current);
    camera.lookAt(world.x, 0.9, world.z - 0.4);
  });

  return (
    <>
      <group ref={group}>
        <Humanoid look={look} motion={motion} />
        {/* soft fill light that keeps the detective readable on dark streets */}
        {map.ambient !== 'station' && <pointLight position={[0, 2.2, 0.6]} intensity={5} distance={5.5} decay={1.6} color="#ffe7c7" />}
        {/* subtle selection ring under the detective */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.36, 0.42, 40]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.55} depthWrite={false} />
        </mesh>
      </group>
      <group ref={arrow}>
        <mesh position={[0, 0.03, 0.85]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 0.34, 3]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual joystick                                                    */
/* ------------------------------------------------------------------ */

function Joystick({ input }: { input: MutableRefObject<Input> }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const R = 46;
  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ x: dx, y: dy });
    const mag = Math.min(1, d / R);
    input.current.stick = mag < 0.15 ? { x: 0, y: 0 } : { x: (dx / R) * 1, y: (dy / R) * 1 };
    input.current.target = null;
  };
  const end = () => {
    setKnob({ x: 0, y: 0 });
    input.current.stick = { x: 0, y: 0 };
  };
  return (
    <div
      ref={base}
      dir="ltr"
      className="absolute bottom-5 left-5 h-32 w-32 rounded-full border border-white/15 bg-noir-panel/55 backdrop-blur"
      style={{ touchAction: 'none' }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.buttons > 0 && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="ג׳ויסטיק תנועה"
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-police-light bg-police/70 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function World3D({
  map,
  playerLook,
  hotspots,
  visitedHotspotIds,
  startPosition,
  guideFacilityId,
  paused,
  onFacility,
  onHotspot,
  onChat,
  onPositionChange,
}: Props) {
  const input = useRef<Input>({ keys: new Set(), stick: { x: 0, y: 0 }, target: null });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const playerWorld = useRef(toWorld((startPosition ?? map.spawn).x, (startPosition ?? map.spawn).y));
  const [nearby, setNearby] = useState<Interactable | null>(null);
  const [fx, setFx] = useState(true);
  const nearbyRef = useRef<Interactable | null>(null);
  nearbyRef.current = nearby;

  const items = useMemo<Interactable[]>(() => {
    const out: Interactable[] = [];
    for (const f of map.facilities) {
      const character = FACILITY_CHARACTERS[f.id];
      out.push({
        id: f.id,
        kind: 'facility',
        x: f.x,
        y: f.y,
        facing: 0,
        label: f.label,
        actionLabel: character ? `שיחה עם ${character.name}` : f.label,
        character,
        facility: f,
        visited: false,
        caseItem: false,
      });
    }
    for (const n of CHAT_NPCS.filter((c) => c.mapId === map.id)) {
      out.push({
        id: n.id,
        kind: 'npc',
        x: n.x,
        y: n.y,
        facing: n.facing,
        label: n.character.role,
        actionLabel: `שיחה עם ${n.character.name}`,
        character: n.character,
        npc: n,
        visited: false,
        caseItem: false,
      });
    }
    for (const h of hotspots) {
      const visited = visitedHotspotIds.includes(h.id);
      out.push({
        id: h.id,
        kind: 'hotspot',
        x: h.x,
        y: h.y,
        facing: h.facing ?? 0,
        label: h.title,
        actionLabel: h.character ? `${h.kind === 'collect' ? 'דיווח' : h.label}: ${h.character.name}` : h.label,
        character: h.character,
        hotspot: h,
        visited,
        caseItem: true,
      });
    }
    return out;
  }, [map, hotspots, visitedHotspotIds]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const guideFacility = guideFacilityId ? map.facilities.find((f) => f.id === guideFacilityId) ?? null : null;
  const guide = guideFacility ? { x: guideFacility.x, y: guideFacility.y } : null;

  const interact = useCallback(
    (it: Interactable | null) => {
      if (!it || pausedRef.current) return;
      input.current.keys.clear();
      input.current.stick = { x: 0, y: 0 };
      input.current.target = null;
      if (it.kind === 'facility' && it.facility) onFacility(it.facility);
      else if (it.kind === 'npc' && it.npc) onChat(it.npc);
      else if (it.hotspot) onHotspot(it.hotspot);
    },
    [onFacility, onHotspot, onChat],
  );

  const tapItem = useCallback(
    (it: Interactable) => {
      if (pausedRef.current) return;
      const p = playerWorld.current;
      const d = Math.hypot(it.x - p.x / TILE, it.y - p.z / TILE);
      if (d < INTERACT_RANGE) interact(it);
      else {
        // walk up to the person or item, stopping just short of it
        const dx = p.x / TILE - it.x;
        const dy = p.z / TILE - it.y;
        const n = Math.hypot(dx, dy) || 1;
        input.current.target = { x: it.x + (dx / n) * 0.9, y: it.y + (dy / n) * 0.9 };
      }
    },
    [interact],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (k === 'shift') input.current.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        input.current.keys.add(k);
        input.current.target = null;
      }
      if (k === 'e' || k === 'enter' || k === ' ') {
        e.preventDefault();
        interact(nearbyRef.current);
      }
    };
    const up = (e: KeyboardEvent) => input.current.keys.delete(e.key.toLowerCase());
    const blur = () => input.current.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [interact]);

  const save = useCallback((x: number, y: number) => onPositionChange(map.id, x, y), [map.id, onPositionChange]);

  const mapW = map.tiles[0].length * TILE;
  const mapH = map.tiles.length * TILE;

  const nearbyIcon = !nearby ? (
    <Crosshair className="h-6 w-6" />
  ) : nearby.character ? (
    <MessageSquare className="h-6 w-6" />
  ) : nearby.kind === 'facility' ? (
    <DoorOpen className="h-6 w-6" />
  ) : nearby.hotspot?.kind === 'cctv' ? (
    <Video className="h-6 w-6" />
  ) : (
    <Search className="h-6 w-6" />
  );

  // LTR root: drei <Html> overlays are positioned with left/translate, which RTL would mirror.
  return (
    <div dir="ltr" className="relative h-full w-full select-none overflow-hidden bg-black">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop={paused ? 'demand' : 'always'}
        camera={{ fov: 42, near: 0.1, far: 120, position: [playerWorld.current.x, 10, playerWorld.current.z + 8] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        style={{ touchAction: 'none' }}
      >
        <MapScene map={map} />

        {/* Ambient occlusion grounds people and furniture; it switches off on devices that can't keep up. */}
        <PerformanceMonitor onDecline={() => setFx(false)} flipflops={2} onFallback={() => setFx(false)} />
        {fx && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <N8AO halfRes quality="performance" aoRadius={1.1} intensity={2.4} distanceFalloff={0.8} />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        )}

        {/* invisible ground for tap-to-move */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[mapW / 2, 0.01, mapH / 2]}
          onPointerDown={(e) => {
            if (pausedRef.current) return;
            input.current.target = { x: e.point.x / TILE, y: e.point.z / TILE };
          }}
        >
          <planeGeometry args={[mapW, mapH]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        {items.map((it) =>
          it.character ? (
            <Npc key={it.id} item={it} player={playerWorld} onTap={tapItem} />
          ) : (
            <PropHotspot key={it.id} item={it} onTap={tapItem} />
          ),
        )}

        {PEDESTRIANS.filter((p) => p.mapId === map.id).map((p, i) => (
          <Walker key={i} ped={p} />
        ))}

        {guide && <Beacon x={guide.x} y={guide.y} />}

        {nearby && (
          <Html position={[nearby.x * TILE, nearby.character ? 2.2 * (nearby.character.look.height ?? 1) : 1.4, nearby.y * TILE]} center zIndexRange={[20, 10]}>
            <div dir="rtl" className="pointer-events-none whitespace-nowrap rounded-lg border border-evidence/70 bg-noir-panel/95 px-2.5 py-1 text-center shadow-xl">
              <div className="text-[12px] font-bold text-slate-50">{nearby.character?.name ?? nearby.label}</div>
              {nearby.character && <div className="text-[10px] text-steel">{nearby.character.role}</div>}
            </div>
          </Html>
        )}

        <Player
          map={map}
          look={playerLook}
          start={startPosition ?? map.spawn}
          input={input}
          pausedRef={pausedRef}
          interactables={itemsRef}
          playerWorld={playerWorld}
          guide={guide}
          onNearby={setNearby}
          onSave={save}
        />
      </Canvas>

      <div dir="rtl" className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="panel pointer-events-auto flex items-center gap-2 bg-noir-panel/85 px-3 py-1.5 backdrop-blur">
          <Compass className="h-4 w-4 text-police-light" />
          <div className="leading-tight">
            <div className="text-xs font-bold text-slate-100">{map.name}</div>
            <div className="text-[10px] text-steel">{map.district}</div>
          </div>
        </div>
      </div>

      <Joystick input={input} />

      <div dir="rtl" className="absolute bottom-6 right-4 flex flex-col items-end gap-2">
        {nearby && (
          <div className="max-w-[13rem] animate-fadeUp rounded-md border border-noir-border bg-noir-panel/95 px-2 py-1 text-right text-[11px] font-bold text-slate-200">
            {nearby.actionLabel}
          </div>
        )}
        <button
          onClick={() => interact(nearbyRef.current)}
          disabled={!nearby}
          aria-label="פעולה"
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-white shadow-lg transition active:scale-95 disabled:opacity-30 ${
            nearby?.caseItem ? 'animate-pulseGlow border-evidence-light bg-evidence/90' : 'border-police-light bg-police/90'
          }`}
        >
          {nearbyIcon}
        </button>
      </div>
    </div>
  );
}
