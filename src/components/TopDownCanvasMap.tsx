import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Crosshair,
  DoorOpen,
  MessageSquare,
  Search,
  Video,
} from 'lucide-react';
import type { FacilityHotspot, GameMap, MapHotspot } from '../types/investigation';
import { WALKABLE_TILES, tileAt } from '../data/maps';

const TILE = 32;
const SPEED = 4.2; // tiles per second
const RADIUS = 0.28; // player collision radius in tiles
const INTERACT_RANGE = 1.5;

type Interactable =
  | { type: 'facility'; id: string; x: number; y: number; label: string; facility: FacilityHotspot }
  | { type: 'hotspot'; id: string; x: number; y: number; label: string; hotspot: MapHotspot };

interface Props {
  map: GameMap;
  hotspots: MapHotspot[];
  visitedHotspotIds: string[];
  startPosition?: { x: number; y: number };
  /** Facility ids to highlight with a guide line (onboarding / objectives). */
  guideFacilityId?: string | null;
  paused: boolean;
  onFacility: (facility: FacilityHotspot) => void;
  onHotspot: (hotspot: MapHotspot) => void;
  onPositionChange: (mapId: string, x: number, y: number) => void;
}

/* ------------------------------------------------------------------ */
/* Static tile layer                                                   */
/* ------------------------------------------------------------------ */

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawTile(ctx: CanvasRenderingContext2D, map: GameMap, ch: string, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  const r = hash(tx, ty);
  const floorBase = (color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, TILE, TILE);
  };
  const indoor = () => {
    floorBase(map.ambient === 'club' ? '#120f18' : '#141b25');
    ctx.strokeStyle = 'rgba(148,163,184,0.06)';
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
  };

  switch (ch) {
    case '#': {
      floorBase('#19212d');
      ctx.fillStyle = '#222c3b';
      ctx.fillRect(x, y, TILE, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + TILE - 4, TILE, 4);
      if (r > 0.85) {
        ctx.fillStyle = 'rgba(148,163,184,0.06)';
        ctx.fillRect(x + 6, y + 10, 10, 2);
      }
      break;
    }
    case '.':
      indoor();
      break;
    case '=': {
      floorBase('#162033');
      ctx.fillStyle = 'rgba(59,130,246,0.05)';
      if ((tx + ty) % 2 === 0) ctx.fillRect(x, y, TILE, TILE);
      break;
    }
    case ',': {
      floorBase('#0f1317');
      if (r > 0.7) {
        ctx.fillStyle = 'rgba(148,163,184,0.05)';
        ctx.fillRect(x + r * 20, y + r * 14, 3, 2);
      }
      if (r < 0.06) {
        // puddle reflecting the street lights
        ctx.fillStyle = 'rgba(59,130,246,0.08)';
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 16, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case '_': {
      floorBase('#1a1f27');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      break;
    }
    case 'G': {
      floorBase('#0f1a13');
      ctx.fillStyle = 'rgba(74,222,128,0.07)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + hash(tx + i, ty) * 28, y + hash(tx, ty + i) * 28, 2, 3);
      break;
    }
    case 'D': {
      indoor();
      ctx.fillStyle = '#2b3a50';
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = 'rgba(59,130,246,0.25)';
      ctx.fillRect(x + 3, y + TILE / 2 - 1, TILE - 6, 2);
      break;
    }
    case 'F': {
      floorBase((tx + ty) % 2 === 0 ? '#1d1030' : '#140b22');
      ctx.strokeStyle = 'rgba(168,85,247,0.25)';
      ctx.strokeRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
      break;
    }
    case 'T': {
      indoor();
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 3, y + 5, TILE - 6, TILE - 10);
      ctx.fillStyle = '#4a3624';
      ctx.fillRect(x + 3, y + 5, TILE - 6, 4);
      ctx.fillStyle = 'rgba(226,232,240,0.6)';
      ctx.fillRect(x + 8 + r * 6, y + 12, 9, 7); // papers
      break;
    }
    case 'S': {
      floorBase('#1a1f27');
      ctx.fillStyle = r > 0.5 ? '#5b1d1d' : '#5b3a12';
      ctx.fillRect(x + 1, y + 2, TILE - 2, TILE - 4);
      ctx.fillStyle = 'rgba(245,158,11,0.18)';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 1 + i * 8, y + 2, 4, TILE - 4);
      break;
    }
    case 'C': {
      floorBase('#0f1317');
      ctx.fillStyle = r > 0.5 ? '#1f2937' : '#312e2b';
      ctx.beginPath();
      ctx.roundRect(x - 4, y + 4, TILE + 8, TILE - 8, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(148,163,184,0.25)';
      ctx.fillRect(x + 4, y + 8, 8, TILE - 16);
      ctx.fillRect(x + TILE - 12, y + 8, 6, TILE - 16);
      break;
    }
    case 'P': {
      floorBase(map.ambient === 'station' ? '#141b25' : '#1a1f27');
      ctx.fillStyle = '#123220';
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b4a2f';
      ctx.beginPath();
      ctx.arc(x + 13, y + 13, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'B': {
      indoor();
      const cork = map.id === 'station' && ty === 5;
      ctx.fillStyle = cork ? '#4a3420' : '#222b38';
      ctx.fillRect(x + 1, y + 4, TILE - 2, TILE - 8);
      if (cork) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x + 6, y + 8, 7, 8);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 18, y + 12, 3, 3);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 1, y + 12, TILE - 2, 2);
        ctx.fillRect(x + 1, y + 20, TILE - 2, 2);
      }
      break;
    }
    case 'X': {
      floorBase(map.ambient === 'street' ? '#1a1f27' : '#141b25');
      ctx.fillStyle = '#3b2f20';
      ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
      ctx.strokeStyle = '#211a12';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + TILE - 4, y + TILE - 4);
      ctx.moveTo(x + TILE - 4, y + 4);
      ctx.lineTo(x + 4, y + TILE - 4);
      ctx.stroke();
      break;
    }
    case 'K': {
      indoor();
      ctx.fillStyle = '#2a1424';
      ctx.fillRect(x, y + 6, TILE, TILE - 12);
      ctx.fillStyle = 'rgba(236,72,153,0.5)';
      ctx.fillRect(x, y + 6, TILE, 2);
      break;
    }
    case 'L': {
      floorBase('#1a1f27');
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      floorBase('#0c1014');
  }
}

function buildStaticLayer(map: GameMap, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = map.tiles[0].length;
  const h = map.tiles.length;
  canvas.width = w * TILE * dpr;
  canvas.height = h * TILE * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) drawTile(ctx, map, map.tiles[ty][tx], tx, ty);
  }
  return canvas;
}

function lightSources(map: GameMap) {
  const lights: { x: number; y: number; r: number }[] = [];
  map.tiles.forEach((row, ty) =>
    [...row].forEach((ch, tx) => {
      if (ch === 'L') lights.push({ x: tx + 0.5, y: ty + 0.5, r: 4.2 });
      if (map.ambient !== 'street' && ch === '.' && tx % 4 === 2 && ty % 3 === 1) {
        lights.push({ x: tx + 0.5, y: ty + 0.5, r: 3.2 });
      }
      if (map.ambient === 'station' && ch === '=' && tx % 4 === 2 && ty % 3 === 1) {
        lights.push({ x: tx + 0.5, y: ty + 0.5, r: 3.4 });
      }
    }),
  );
  return lights;
}

/* ------------------------------------------------------------------ */
/* Dynamic sprites                                                     */
/* ------------------------------------------------------------------ */

function drawPerson(ctx: CanvasRenderingContext2D, px: number, py: number, color: string, facing: number, bob: number, isPlayer: boolean) {
  ctx.save();
  ctx.translate(px, py + bob);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(0, 9, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(facing);
  // shoulders
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // head
  ctx.fillStyle = '#d6b89a';
  ctx.beginPath();
  ctx.arc(2, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f1a17';
  ctx.beginPath();
  ctx.arc(1, 0, 5, Math.PI * 0.6, Math.PI * 1.4);
  ctx.fill();
  ctx.restore();
}

function drawHotspotIcon(ctx: CanvasRenderingContext2D, kind: MapHotspot['kind'] | 'facility', x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (kind === 'collect') {
    ctx.beginPath();
    ctx.arc(-2, -2, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 2);
    ctx.lineTo(6, 6);
    ctx.stroke();
  } else if (kind === 'witness') {
    ctx.beginPath();
    ctx.roundRect(-7, -6, 14, 9, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, 3);
    ctx.lineTo(-5, 7);
    ctx.lineTo(1, 3);
    ctx.stroke();
  } else if (kind === 'cctv') {
    ctx.beginPath();
    ctx.roundRect(-7, -5, 11, 7, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.lineTo(8, -4);
    ctx.lineTo(8, 1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-3, 6);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function TopDownCanvasMap({
  map,
  hotspots,
  visitedHotspotIds,
  startPosition,
  guideFacilityId,
  paused,
  onFacility,
  onHotspot,
  onPositionChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pos = useRef({ ...(startPosition ?? map.spawn) });
  const facing = useRef(-Math.PI / 2);
  const keys = useRef(new Set<string>());
  const dpad = useRef({ x: 0, y: 0 });
  const target = useRef<{ x: number; y: number } | null>(null);
  const walkPhase = useRef(0);
  const nearbyRef = useRef<Interactable | null>(null);
  const [nearby, setNearby] = useState<Interactable | null>(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const staticLayer = useMemo(() => buildStaticLayer(map, dpr), [map, dpr]);
  const lights = useMemo(() => lightSources(map), [map]);
  const rain = useMemo(
    () => Array.from({ length: 70 }, (_, i) => ({ x: hash(i, 3) * 1000, y: hash(3, i) * 1000, s: 0.6 + hash(i, i) * 0.8 })),
    [],
  );

  const interactables = useMemo<Interactable[]>(
    () => [
      ...map.facilities.map((f) => ({ type: 'facility' as const, id: f.id, x: f.x, y: f.y, label: f.label, facility: f })),
      ...hotspots.map((h) => ({ type: 'hotspot' as const, id: h.id, x: h.x, y: h.y, label: h.title, hotspot: h })),
    ],
    [map, hotspots],
  );
  const interactablesRef = useRef(interactables);
  interactablesRef.current = interactables;
  const visitedRef = useRef(visitedHotspotIds);
  visitedRef.current = visitedHotspotIds;
  const guideRef = useRef(guideFacilityId);
  guideRef.current = guideFacilityId;

  // Reset the player when the map changes.
  useEffect(() => {
    pos.current = { ...(startPosition ?? map.spawn) };
    target.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id]);

  const interact = useCallback(
    (item: Interactable | null) => {
      if (!item || pausedRef.current) return;
      keys.current.clear();
      dpad.current = { x: 0, y: 0 };
      target.current = null;
      if (item.type === 'facility') onFacility(item.facility);
      else onHotspot(item.hotspot);
    },
    [onFacility, onHotspot],
  );

  // Container sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(200, Math.floor(width)), h: Math.max(200, Math.floor(height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        keys.current.add(k);
        target.current = null;
      }
      if (k === 'e' || k === 'enter' || k === ' ') {
        e.preventDefault();
        interact(nearbyRef.current);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [interact]);

  // Persist position on unmount
  useEffect(
    () => () => onPositionChange(map.id, pos.current.x, pos.current.y),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map.id],
  );

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const light = document.createElement('canvas');
    light.width = canvas.width;
    light.height = canvas.height;
    const lctx = light.getContext('2d')!;
    const mapW = map.tiles[0].length * TILE;
    const mapH = map.tiles.length * TILE;

    const blocked = (x: number, y: number) =>
      [
        [x - RADIUS, y - RADIUS],
        [x + RADIUS, y - RADIUS],
        [x - RADIUS, y + RADIUS],
        [x + RADIUS, y + RADIUS],
      ].some(([cx, cy]) => !WALKABLE_TILES.has(tileAt(map, cx, cy)));

    let raf = 0;
    let last = performance.now();
    let saveTimer = 0;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = pos.current;

      // ---- input
      let ix = 0;
      let iy = 0;
      if (!pausedRef.current) {
        const k = keys.current;
        if (k.has('arrowleft') || k.has('a')) ix -= 1;
        if (k.has('arrowright') || k.has('d')) ix += 1;
        if (k.has('arrowup') || k.has('w')) iy -= 1;
        if (k.has('arrowdown') || k.has('s')) iy += 1;
        ix += dpad.current.x;
        iy += dpad.current.y;
        if (ix === 0 && iy === 0 && target.current) {
          const dx = target.current.x - p.x;
          const dy = target.current.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 0.12) target.current = null;
          else {
            ix = dx / dist;
            iy = dy / dist;
          }
        }
      }
      const len = Math.hypot(ix, iy);
      if (len > 0) {
        ix /= len;
        iy /= len;
        facing.current = Math.atan2(iy, ix);
        const step = SPEED * dt;
        const nx = p.x + ix * step;
        const ny = p.y + iy * step;
        let moved = false;
        if (!blocked(nx, p.y)) {
          p.x = nx;
          moved = true;
        }
        if (!blocked(p.x, ny)) {
          p.y = ny;
          moved = true;
        }
        if (!moved) target.current = null;
        walkPhase.current += dt * 12;
      }

      // ---- proximity
      let best: Interactable | null = null;
      let bestD = INTERACT_RANGE;
      for (const it of interactablesRef.current) {
        const d = Math.hypot(it.x - p.x, it.y - p.y);
        if (d < bestD) {
          best = it;
          bestD = d;
        }
      }
      if (best?.id !== nearbyRef.current?.id) {
        nearbyRef.current = best;
        setNearby(best);
      }

      saveTimer += dt;
      if (saveTimer > 2) {
        saveTimer = 0;
        onPositionChange(map.id, p.x, p.y);
      }

      // ---- camera
      const vw = size.w;
      const vh = size.h;
      const camX = mapW <= vw ? (mapW - vw) / 2 : Math.max(0, Math.min(mapW - vw, p.x * TILE - vw / 2));
      const camY = mapH <= vh ? (mapH - vh) / 2 : Math.max(0, Math.min(mapH - vh, p.y * TILE - vh / 2));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#07090c';
      ctx.fillRect(0, 0, vw, vh);
      ctx.drawImage(staticLayer, -camX, -camY, mapW, mapH);

      const t = now / 1000;
      const sx = (x: number) => x * TILE - camX;
      const sy = (y: number) => y * TILE - camY;

      // ---- guide line to objective
      const guide = guideRef.current ? map.facilities.find((f) => f.id === guideRef.current) : null;
      if (guide) {
        ctx.save();
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = 'rgba(59,130,246,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx(p.x), sy(p.y));
        ctx.lineTo(sx(guide.x), sy(guide.y));
        ctx.stroke();
        ctx.restore();
      }

      // ---- NPCs
      map.npcs.forEach((n, i) => drawPerson(ctx, sx(n.x), sy(n.y), n.color, n.facing, Math.sin(t * 1.5 + i) * 0.6, false));

      // ---- interactables
      for (const it of interactablesRef.current) {
        const x = sx(it.x);
        const y = sy(it.y);
        if (x < -40 || y < -40 || x > vw + 40 || y > vh + 40) continue;
        const isFacility = it.type === 'facility';
        const visited = !isFacility && visitedRef.current.includes(it.id);
        const isGuide = isFacility && it.id === guideRef.current;
        const color = visited ? '#64748b' : isFacility ? (isGuide ? '#60a5fa' : '#3b82f6') : '#f59e0b';
        const pulse = visited ? 0 : (Math.sin(t * 3 + it.x) + 1) / 2;
        ctx.save();
        ctx.fillStyle = visited ? 'rgba(15,23,42,0.75)' : 'rgba(12,16,20,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (!visited) {
          ctx.globalAlpha = 0.6 * (1 - pulse);
          ctx.beginPath();
          ctx.arc(x, y, 12 + pulse * (isGuide ? 16 : 10), 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        drawHotspotIcon(ctx, isFacility ? 'facility' : it.hotspot.kind, x, y, color);
      }

      // ---- player
      const bob = len > 0 ? Math.sin(walkPhase.current) * 1.2 : 0;
      drawPerson(ctx, sx(p.x), sy(p.y), '#1d4ed8', facing.current, bob, true);

      // ---- lighting
      const darkness = map.ambient === 'station' ? 0.42 : map.ambient === 'club' ? 0.62 : 0.56;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lctx.globalCompositeOperation = 'source-over';
      lctx.clearRect(0, 0, vw, vh);
      lctx.fillStyle = `rgba(3,5,9,${darkness})`;
      lctx.fillRect(0, 0, vw, vh);
      lctx.globalCompositeOperation = 'destination-out';
      const punch = (x: number, y: number, r: number, strength: number) => {
        const g = lctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${strength})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (const l of lights) {
        const x = sx(l.x);
        const y = sy(l.y);
        const r = l.r * TILE;
        if (x < -r || y < -r || x > vw + r || y > vh + r) continue;
        punch(x, y, r, 0.85);
      }
      for (const it of interactablesRef.current) punch(sx(it.x), sy(it.y), TILE * 1.4, 0.7);
      // flashlight cone
      const fx = sx(p.x);
      const fy = sy(p.y);
      punch(fx, fy, TILE * 3.2, 0.95);
      punch(fx + Math.cos(facing.current) * TILE * 2.4, fy + Math.sin(facing.current) * TILE * 2.4, TILE * 2.6, 0.7);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(light, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // ---- ambience
      if (map.ambient === 'club') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const hue = (t * 40) % 360;
        map.tiles.forEach((row, ty) =>
          [...row].forEach((ch, tx) => {
            if (ch !== 'F' || (tx + ty) % 2) return;
            ctx.fillStyle = `hsla(${(hue + tx * 20) % 360},80%,55%,0.07)`;
            ctx.beginPath();
            ctx.arc(sx(tx + 0.5), sy(ty + 0.5), TILE * 1.6, 0, Math.PI * 2);
            ctx.fill();
          }),
        );
        ctx.restore();
      }
      if (map.ambient === 'street') {
        ctx.save();
        ctx.strokeStyle = 'rgba(148,163,184,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const d of rain) {
          const x = (d.x + t * 60 * d.s) % (vw + 40) - 20;
          const y = (d.y + t * 520 * d.s) % (vh + 40) - 20;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + 11);
        }
        ctx.stroke();
        ctx.restore();
      }

      // ---- labels
      ctx.save();
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.font = '700 11px Heebo, Arial, sans-serif';
      for (const l of map.labels) {
        const x = sx(l.x);
        const y = sy(l.y);
        if (x < -80 || x > vw + 80 || y < -20 || y > vh + 20) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const w = ctx.measureText(l.text).width + 10;
        ctx.fillRect(x - w / 2, y - 7, w, 15);
        ctx.fillStyle = 'rgba(203,213,225,0.85)';
        ctx.fillText(l.text, x, y + 4);
      }
      const near = nearbyRef.current;
      if (near) {
        const x = sx(near.x);
        const y = sy(near.y) - 22;
        ctx.font = '700 12px Heebo, Arial, sans-serif';
        const w = ctx.measureText(near.label).width + 14;
        ctx.fillStyle = 'rgba(12,16,20,0.92)';
        ctx.strokeStyle = near.type === 'facility' ? '#3b82f6' : '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y - 10, w, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(near.label, x, y + 4);
      }
      ctx.restore();

      // ---- vignette
      const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, vw, vh);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, size, dpr, staticLayer, lights, rain, onPositionChange]);

  // Tap to move / tap to interact
  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (paused) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mapW = map.tiles[0].length * TILE;
    const mapH = map.tiles.length * TILE;
    const p = pos.current;
    const camX = mapW <= size.w ? (mapW - size.w) / 2 : Math.max(0, Math.min(mapW - size.w, p.x * TILE - size.w / 2));
    const camY = mapH <= size.h ? (mapH - size.h) / 2 : Math.max(0, Math.min(mapH - size.h, p.y * TILE - size.h / 2));
    const wx = (e.clientX - rect.left + camX) / TILE;
    const wy = (e.clientY - rect.top + camY) / TILE;
    const tapped = interactables.find((it) => Math.hypot(it.x - wx, it.y - wy) < 0.7);
    if (tapped && Math.hypot(tapped.x - p.x, tapped.y - p.y) < INTERACT_RANGE) {
      interact(tapped);
      return;
    }
    target.current = { x: wx, y: wy };
  };

  const pad = (x: number, y: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dpad.current = { x, y };
      target.current = null;
    },
    onPointerUp: () => (dpad.current = { x: 0, y: 0 }),
    onPointerCancel: () => (dpad.current = { x: 0, y: 0 }),
    onPointerLeave: () => (dpad.current = { x: 0, y: 0 }),
  });

  const nearbyIcon = !nearby ? (
    <Crosshair className="h-6 w-6" />
  ) : nearby.type === 'facility' ? (
    <DoorOpen className="h-6 w-6" />
  ) : nearby.hotspot.kind === 'witness' ? (
    <MessageSquare className="h-6 w-6" />
  ) : nearby.hotspot.kind === 'cctv' ? (
    <Video className="h-6 w-6" />
  ) : (
    <Search className="h-6 w-6" />
  );

  return (
    <div ref={containerRef} className="relative h-full w-full select-none overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h, touchAction: 'none' }}
        onPointerDown={handlePointer}
        aria-label={`מפת ${map.name}`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="panel pointer-events-auto flex items-center gap-2 bg-noir-panel/90 px-3 py-1.5 backdrop-blur">
          <Compass className="h-4 w-4 text-police-light" />
          <div className="leading-tight">
            <div className="text-xs font-bold text-slate-100">{map.name}</div>
            <div className="text-[10px] text-steel">{map.district}</div>
          </div>
        </div>
      </div>

      {/* Virtual D-Pad: physical directions, so the pad itself is LTR */}
      <div dir="ltr" className="absolute bottom-4 left-4 grid grid-cols-3 grid-rows-3 gap-1 opacity-90">
        <span />
        <button aria-label="למעלה" className="dpad-btn" {...pad(0, -1)}>
          <ChevronUp className="h-6 w-6" />
        </button>
        <span />
        <button aria-label="שמאלה" className="dpad-btn" {...pad(-1, 0)}>
          <ChevronLeft className="h-6 w-6" />
        </button>
        <span className="rounded-full border border-noir-border bg-noir-deep/60" />
        <button aria-label="ימינה" className="dpad-btn" {...pad(1, 0)}>
          <ChevronRight className="h-6 w-6" />
        </button>
        <span />
        <button aria-label="למטה" className="dpad-btn" {...pad(0, 1)}>
          <ChevronDown className="h-6 w-6" />
        </button>
        <span />
      </div>

      <div className="absolute bottom-6 right-4 flex flex-col items-end gap-2">
        {nearby && (
          <div className="max-w-[11rem] animate-fadeUp rounded-md border border-noir-border bg-noir-panel/95 px-2 py-1 text-right text-[11px] text-steel">
            {nearby.type === 'facility' ? 'כניסה' : nearby.hotspot.label}
          </div>
        )}
        <button
          onClick={() => interact(nearbyRef.current)}
          disabled={!nearby}
          aria-label="פעולה"
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-white shadow-lg transition active:scale-95 disabled:opacity-30 ${
            nearby?.type === 'hotspot'
              ? 'animate-pulseGlow border-evidence-light bg-evidence/90'
              : 'border-police-light bg-police/90'
          }`}
        >
          {nearbyIcon}
        </button>
      </div>
    </div>
  );
}
