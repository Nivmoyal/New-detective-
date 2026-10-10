import { useEffect, useRef, useState } from 'react';
import { Hand, MessageSquare, Search } from 'lucide-react';
import type { CharacterLook, CharacterRef, MapHotspot } from '../types/investigation';
import type { ChatNpc } from '../data/characters';
import { FACILITY_CHARACTERS } from '../data/characters';
import { WorldRenderer, type Drawable } from '../pixel/world/renderer';
import { T, type PixelMap, type PlacedFacility, type Prop } from '../pixel/world/types';
import { drawEvidenceItem, examineText, propDef, propName } from '../pixel/world/props';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, drawCharacter, type Dir } from '../pixel/sprites';

export interface WorldHotspot {
  hotspot: MapHotspot;
  caseId: string;
  /** Requirements met (otherwise the place is locked / the person has nothing to add). */
  available: boolean;
  visited: boolean;
}

interface Props {
  map: PixelMap;
  playerLook: CharacterLook;
  hotspots: WorldHotspot[];
  startPosition?: { x: number; y: number };
  paused: boolean;
  onFacility: (f: PlacedFacility) => void;
  onHotspot: (h: WorldHotspot) => void;
  onChat: (npc: ChatNpc) => void;
  onExamine: (title: string, text: string) => void;
  onPositionChange: (mapId: string, x: number, y: number) => void;
}

interface Actor {
  key: string;
  x: number;
  y: number;
  dir: Dir;
  look: CharacterLook;
  moving: boolean;
  anim: number;
  solid: boolean;
  path?: { x: number; y: number }[];
  speed?: number;
  leg?: number;
  pauseUntil?: number;
  homeDir: Dir;
}

type Target =
  | { kind: 'facility'; f: PlacedFacility; x: number; y: number; name: string; actor?: Actor }
  | { kind: 'hotspot'; hs: WorldHotspot[]; x: number; y: number; name: string; actor?: Actor }
  | { kind: 'npc'; npc: ChatNpc; x: number; y: number; name: string; actor: Actor }
  | { kind: 'prop'; p: Prop; x: number; y: number; name: string };

const SPEED = 4.2;
const TALK_RANGE = 2.1;
const PROP_RANGE = 1.25;

function dirFromVec(dx: number, dy: number, fallback: Dir): Dir {
  if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? DIR_LEFT : DIR_RIGHT;
  return dy < 0 ? DIR_UP : DIR_DOWN;
}

function rectDist(px: number, py: number, x: number, y: number, w: number, h: number) {
  const cx = Math.max(x, Math.min(px, x + w));
  const cy = Math.max(y, Math.min(py, y + h));
  return Math.hypot(px - cx, py - cy);
}

export default function PixelWorld({
  map,
  playerLook,
  hotspots,
  startPosition,
  paused,
  onFacility,
  onHotspot,
  onChat,
  onExamine,
  onPositionChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prompt, setPrompt] = useState<{ name: string; verb: string; kind: Target['kind'] } | null>(null);

  // Live values used inside the animation loop.
  const live = useRef({ paused, hotspots, onFacility, onHotspot, onChat, onExamine, onPositionChange });
  live.current = { paused, hotspots, onFacility, onHotspot, onChat, onExamine, onPositionChange };
  const interactRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const display = canvas.getContext('2d')!;
    const renderer = new WorldRenderer(map);
    const buffer = document.createElement('canvas');
    const bctx = buffer.getContext('2d')!;
    let scale = 4;
    let dpr = 1;
    let vw = 0;
    let vh = 0;

    const resize = () => {
      dpr = Math.min(3, window.devicePixelRatio || 1);
      const cw = wrap.clientWidth;
      const ch = wrap.clientHeight;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      scale = Math.max(2, Math.round((Math.min(cw, ch * 1.25) * dpr) / 200));
      vw = Math.ceil(canvas.width / scale);
      vh = Math.ceil(canvas.height / scale);
      buffer.width = vw;
      buffer.height = vh;
      bctx.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ---------------- Actors ---------------- */
    const start = startPosition ?? map.spawn;
    const player: Actor = { key: 'player', x: start.x, y: start.y, dir: DIR_DOWN, look: playerLook, moving: false, anim: 0, solid: false, homeDir: DIR_DOWN };

    const npcActors = new Map<string, { actor: Actor; npc: ChatNpc }>();
    for (const n of map.npcs) {
      const actor: Actor = {
        key: n.id,
        x: n.x,
        y: n.y,
        dir: n.dir,
        look: n.look,
        moving: false,
        anim: Math.random() * 4,
        solid: !n.path,
        path: n.path,
        speed: n.speed ?? 1,
        leg: 1,
        homeDir: n.dir,
      };
      npcActors.set(n.id, { actor, npc: { id: n.id, character: { name: n.name, role: n.role, look: n.look }, lines: n.lines } });
    }
    const facilityActors = new Map<string, Actor>();
    for (const f of map.facilities) {
      if (f.object) continue;
      const ch = FACILITY_CHARACTERS[f.id];
      if (!ch) continue;
      facilityActors.set(f.id, { key: f.id, x: f.x, y: f.y, dir: f.dir, look: ch.look, moving: false, anim: 0, solid: true, homeDir: f.dir });
    }
    const hotspotActors = new Map<string, Actor>();

    const hotspotGroups = () => {
      const groups = new Map<string, WorldHotspot[]>();
      for (const wh of live.current.hotspots) {
        const list = groups.get(wh.hotspot.anchor) ?? [];
        list.push(wh);
        groups.set(wh.hotspot.anchor, list);
      }
      return groups;
    };
    const characterFor = (list: WorldHotspot[]): CharacterRef | undefined => list.find((w) => w.hotspot.character)?.hotspot.character;

    const ensureHotspotActor = (anchor: string, ch: CharacterRef) => {
      let a = hotspotActors.get(anchor);
      const pos = map.anchors[anchor];
      if (!a && pos) {
        a = { key: anchor, x: pos.x, y: pos.y, dir: pos.dir, look: ch.look, moving: false, anim: 0, solid: true, homeDir: pos.dir };
        hotspotActors.set(anchor, a);
      }
      return a;
    };

    const solidActors = (): Actor[] => {
      const out: Actor[] = [];
      for (const { actor } of npcActors.values()) if (actor.solid) out.push(actor);
      for (const a of facilityActors.values()) out.push(a);
      for (const [anchor, a] of hotspotActors) if (hotspotGroups().has(anchor)) out.push(a);
      return out;
    };

    /* ---------------- Collision & paths ---------------- */
    const blockedTile = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= map.w || ty >= map.h || map.blocked[ty * map.w + tx] === 1;
    const HW = 0.28;
    const free = (x: number, y: number, solids: Actor[]) => {
      const pts = [
        [x - HW, y - 0.22],
        [x + HW, y - 0.22],
        [x - HW, y],
        [x + HW, y],
      ];
      for (const [px, py] of pts) if (blockedTile(Math.floor(px), Math.floor(py))) return false;
      for (const a of solids) if (Math.hypot(a.x - x, (a.y - y) * 1.4) < 0.55) return false;
      return true;
    };

    let path: { x: number; y: number }[] = [];
    let pendingTarget: Target | null = null;

    const findPath = (tx: number, ty: number, goal?: (x: number, y: number) => boolean) => {
      const sx = Math.floor(player.x);
      const sy = Math.floor(player.y);
      const occupied = new Set(solidActors().map((a) => `${Math.floor(a.x)},${Math.floor(a.y)}`));
      const isGoal = goal ?? ((x: number, y: number) => x === tx && y === ty);
      const prev = new Map<number, number>();
      const key = (x: number, y: number) => y * map.w + x;
      const q: number[] = [key(sx, sy)];
      prev.set(key(sx, sy), -1);
      let found = -1;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (let qi = 0; qi < q.length && qi < 6000; qi++) {
        const k = q[qi];
        const x = k % map.w;
        const y = (k - x) / map.w;
        if (isGoal(x, y)) {
          found = k;
          break;
        }
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          const nk = key(nx, ny);
          if (prev.has(nk) || blockedTile(nx, ny) || occupied.has(`${nx},${ny}`)) continue;
          if (dx && dy && (blockedTile(x + dx, y) || blockedTile(x, y + dy))) continue;
          prev.set(nk, k);
          q.push(nk);
        }
      }
      if (found < 0) return false;
      const out: { x: number; y: number }[] = [];
      for (let k = found; k !== -1 && k !== key(sx, sy); k = prev.get(k)!) {
        const x = k % map.w;
        out.push({ x: x + 0.5, y: (k - x) / map.w + 0.6 });
      }
      path = out.reverse();
      return true;
    };

    /* ---------------- Targets ---------------- */
    const targets = (): Target[] => {
      const out: Target[] = [];
      for (const f of map.facilities) {
        const actor = facilityActors.get(f.id);
        if (actor) out.push({ kind: 'facility', f, x: actor.x, y: actor.y, name: FACILITY_CHARACTERS[f.id]?.name ?? f.label, actor });
      }
      for (const [anchor, list] of hotspotGroups()) {
        const pos = map.anchors[anchor];
        if (!pos) continue;
        const ch = characterFor(list);
        const actor = ch ? ensureHotspotActor(anchor, ch) : undefined;
        const open = list.find((w) => w.available && !w.visited) ?? list.find((w) => w.available) ?? list[0];
        const name = ch ? ch.name : open.available ? open.hotspot.title : open.hotspot.lockedLabel ?? open.hotspot.title;
        out.push({ kind: 'hotspot', hs: list, x: actor?.x ?? pos.x, y: actor?.y ?? pos.y, name, actor });
      }
      for (const { actor, npc } of npcActors.values()) out.push({ kind: 'npc', npc, x: actor.x, y: actor.y, name: npc.character.name, actor });
      for (const p of map.props) {
        const def = propDef(p);
        // Floor decals are scenery unless they were given something specific to say.
        if (def.flat && !def.wall && !p.examine) continue;
        out.push({ kind: 'prop', p, x: p.x + p.w / 2, y: p.y + p.h / 2, name: propName(p) });
      }
      return out;
    };

    const distTo = (t: Target) => {
      if (t.kind === 'prop') {
        const wallProp = propDef(t.p).wall;
        // Things on a facade can only be seen from the street side.
        if (wallProp && player.y < t.p.y + t.p.h) return Infinity;
        return rectDist(player.x, player.y - 0.3, t.p.x, t.p.y, t.p.w, t.p.h + (wallProp ? 0.4 : 0));
      }
      return Math.hypot(t.x - player.x, t.y - player.y);
    };

    const nearest = (): Target | null => {
      let best: Target | null = null;
      let bestScore = Infinity;
      const fx = player.dir === DIR_LEFT ? -1 : player.dir === DIR_RIGHT ? 1 : 0;
      const fy = player.dir === DIR_UP ? -1 : player.dir === DIR_DOWN ? 1 : 0;
      for (const t of targets()) {
        const d = distTo(t);
        const range = t.kind === 'prop' ? PROP_RANGE : t.kind === 'hotspot' && !t.actor ? 1.4 : TALK_RANGE;
        if (d > range) continue;
        const dx = t.x - player.x;
        const dy = t.y - player.y;
        const facing = (dx * fx + dy * fy) / (Math.hypot(dx, dy) || 1);
        const bias = t.kind !== 'prop' ? 0 : t.p.facility ? -0.6 : propDef(t.p).minor ? 1.6 : 0.9;
        const score = d - facing * 0.6 + bias;
        if (score < bestScore) {
          bestScore = score;
          best = t;
        }
      }
      return best;
    };

    const faceEachOther = (a?: Actor) => {
      if (!a) return;
      a.dir = dirFromVec(player.x - a.x, player.y - a.y, a.dir);
      a.pauseUntil = performance.now() + 6000;
      player.dir = dirFromVec(a.x - player.x, a.y - player.y, player.dir);
    };

    const use = (t: Target) => {
      const L = live.current;
      path = [];
      pendingTarget = null;
      switch (t.kind) {
        case 'facility':
          faceEachOther(t.actor);
          L.onFacility(t.f);
          return;
        case 'hotspot': {
          faceEachOther(t.actor);
          const pick = t.hs.find((w) => w.available && !w.visited) ?? t.hs.find((w) => w.available) ?? t.hs[0];
          L.onHotspot(pick);
          return;
        }
        case 'npc':
          faceEachOther(t.actor);
          L.onChat(t.npc);
          return;
        case 'prop':
          player.dir = dirFromVec(t.x - player.x, t.y - player.y, player.dir);
          if (t.p.facility) {
            const f = map.facilities.find((ff) => ff.id === t.p.facility);
            if (f) return L.onFacility(f);
          }
          L.onExamine(propName(t.p), examineText(t.p));
      }
    };
    interactRef.current = () => {
      const t = nearest();
      if (t) use(t);
    };

    /* ---------------- Input ---------------- */
    const keys = new Set<string>();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (e.type === 'keydown') {
        if (['e', ' ', 'enter'].includes(k)) {
          if (!live.current.paused) interactRef.current();
          e.preventDefault();
          return;
        }
        keys.add(k);
        if (k.startsWith('arrow')) e.preventDefault();
        path = [];
        pendingTarget = null;
      } else keys.delete(k);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    let camX = 0;
    let camY = 0;
    let pointer: { id: number; sx: number; sy: number; x: number; y: number; drag: boolean } | null = null;
    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const lx = ((clientX - rect.left) * dpr) / scale;
      const ly = ((clientY - rect.top) * dpr) / scale;
      return { x: (lx + camX) / T, y: (ly + camY) / T };
    };
    const onDown = (e: PointerEvent) => {
      if (live.current.paused) return;
      canvas.setPointerCapture(e.pointerId);
      pointer = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, drag: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (!pointer.drag && Math.hypot(pointer.x - pointer.sx, pointer.y - pointer.sy) > 14) {
        pointer.drag = true;
        path = [];
        pendingTarget = null;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!pointer || pointer.id !== e.pointerId) return;
      const p = pointer;
      pointer = null;
      if (p.drag || live.current.paused) return;
      const w = toWorld(e.clientX, e.clientY);
      // Did the tap hit something?
      let hit: Target | null = null;
      let best = Infinity;
      for (const t of targets()) {
        let d: number;
        if (t.kind === 'prop') {
          const def = propDef(t.p);
          const extra = def.wall ? 0 : t.p.h === 1 && ['lamp', 'tree', 'palm', 'cabinet', 'bookshelf', 'fridge', 'pillar'].includes(t.p.type) ? 1.4 : 0.4;
          d = rectDist(w.x, w.y, t.p.x, t.p.y - extra, t.p.w, t.p.h + extra);
          // People win over the furniture they stand next to.
          d += 0.1;
        } else {
          d = rectDist(w.x, w.y, t.x - 0.5, t.y - 1.5, 1, 1.6);
        }
        if (d < 0.3 && d < best) {
          best = d;
          hit = t;
        }
      }
      if (hit) {
        if (distTo(hit) <= (hit.kind === 'prop' ? PROP_RANGE : TALK_RANGE) - 0.1) return use(hit);
        const h = hit;
        const range = h.kind === 'prop' ? PROP_RANGE - 0.2 : TALK_RANGE - 0.6;
        const ok = findPath(0, 0, (x, y) => {
          if (h.kind === 'prop') return rectDist(x + 0.5, y + 0.3, h.p.x, h.p.y, h.p.w, h.p.h + (propDef(h.p).wall ? 0.4 : 0)) <= range;
          return Math.hypot(h.x - (x + 0.5), h.y - (y + 0.6)) <= range;
        });
        if (ok) pendingTarget = h;
        return;
      }
      const tx = Math.floor(w.x);
      const ty = Math.floor(w.y);
      if (!findPath(tx, ty)) findPath(tx, ty, (x, y) => Math.hypot(x + 0.5 - w.x, y + 0.5 - w.y) <= 1.6);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    /* ---------------- Loop ---------------- */
    let raf = 0;
    let last = performance.now();
    let lastSave = 0;
    let lastPrompt = '';

    const moveActor = (a: Actor, dx: number, dy: number, dt: number, speed: number, solids: Actor[]) => {
      const len = Math.hypot(dx, dy);
      if (len < 1e-3) {
        a.moving = false;
        return;
      }
      const vx = (dx / len) * speed * dt;
      const vy = (dy / len) * speed * dt;
      const others = solids.filter((s) => s !== a);
      let moved = false;
      if (free(a.x + vx, a.y, others)) {
        a.x += vx;
        moved = true;
      }
      if (free(a.x, a.y + vy, others)) {
        a.y += vy;
        moved = true;
      }
      a.moving = moved;
      a.dir = dirFromVec(dx, dy, a.dir);
      if (moved) a.anim += dt * speed * 2.1;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const L = live.current;
      const solids = solidActors();

      if (!L.paused) {
        // Player input.
        let ix = 0;
        let iy = 0;
        if (keys.has('arrowleft') || keys.has('a')) ix -= 1;
        if (keys.has('arrowright') || keys.has('d')) ix += 1;
        if (keys.has('arrowup') || keys.has('w')) iy -= 1;
        if (keys.has('arrowdown') || keys.has('s')) iy += 1;
        if (pointer?.drag) {
          ix = pointer.x - pointer.sx;
          iy = pointer.y - pointer.sy;
        }
        if (ix || iy) moveActor(player, ix, iy, dt, SPEED, solids);
        else if (path.length) {
          const wp = path[0];
          const dx = wp.x - player.x;
          const dy = wp.y - player.y;
          if (Math.hypot(dx, dy) < 0.12) path.shift();
          else {
            const bx = player.x;
            const by = player.y;
            moveActor(player, dx, dy, dt, SPEED, solids);
            if (Math.abs(bx - player.x) + Math.abs(by - player.y) < 1e-4) path = [];
          }
          if (!path.length && pendingTarget) {
            const tg = pendingTarget;
            pendingTarget = null;
            use(tg);
          }
        } else player.moving = false;
      } else {
        player.moving = false;
      }

      // Walkers.
      for (const { actor } of npcActors.values()) {
        if (!actor.path || actor.path.length < 2) continue;
        if (L.paused || (actor.pauseUntil && actor.pauseUntil > now)) {
          actor.moving = false;
          continue;
        }
        const wp = actor.path[actor.leg ?? 1];
        const dx = wp.x - actor.x;
        const dy = wp.y - actor.y;
        if (Math.hypot(dx, dy) < 0.1) {
          actor.leg = ((actor.leg ?? 1) + 1) % actor.path.length;
          continue;
        }
        const len = Math.hypot(dx, dy);
        const step = Math.min(len, (actor.speed ?? 1) * dt);
        // Walkers yield to the player instead of walking through them.
        if (Math.hypot(actor.x + (dx / len) * step - player.x, actor.y + (dy / len) * step - player.y) < 0.55) {
          actor.moving = false;
          continue;
        }
        actor.x += (dx / len) * step;
        actor.y += (dy / len) * step;
        actor.dir = dirFromVec(dx, dy, actor.dir);
        actor.moving = true;
        actor.anim += dt * (actor.speed ?? 1) * 2.1;
      }
      for (const a of [...facilityActors.values(), ...hotspotActors.values()]) {
        if (a.pauseUntil && a.pauseUntil < now) {
          a.dir = a.homeDir;
          a.pauseUntil = undefined;
        }
      }

      // Camera.
      const targetX = player.x * T - vw / 2;
      const targetY = (player.y - 0.6) * T - vh / 2;
      const maxX = map.w * T - vw;
      const maxY = map.h * T - vh;
      camX = maxX < 0 ? maxX / 2 : Math.max(0, Math.min(maxX, targetX));
      camY = maxY < 0 ? maxY / 2 : Math.max(0, Math.min(maxY, targetY));

      const openB = renderer.buildingAt(player.x, player.y - 0.1);
      const openId = openB?.id ?? null;

      /* Draw world */
      const ents: Drawable[] = [];
      const drawActor = (a: Actor) => {
        ents.push({
          base: a.y * T,
          draw: (c) => {
            c.fillStyle = 'rgba(0,0,0,0.35)';
            c.fillRect(Math.round(a.x * T - 5), Math.round(a.y * T - 1), 10, 2);
            drawCharacter(c, a.look, a.x * T, a.y * T, a.dir, a.moving ? Math.floor(a.anim) % 4 : 0);
          },
        });
      };
      drawActor(player);
      for (const { actor } of npcActors.values()) drawActor(actor);
      for (const a of facilityActors.values()) drawActor(a);
      const groups = hotspotGroups();
      for (const [anchor, list] of groups) {
        const pos = map.anchors[anchor];
        if (!pos) continue;
        const ch = characterFor(list);
        if (ch) {
          const a = ensureHotspotActor(anchor, ch);
          if (a) drawActor(a);
          continue;
        }
        const h = list[0];
        const showItem = h.hotspot.kind === 'cctv' || (h.available && !h.visited);
        if (showItem) ents.push({ base: pos.y * T - 2, draw: (c) => drawEvidenceItem(c, pos.x * T - 8, pos.y * T - 12, h.hotspot.kind) });
      }
      renderer.render(bctx, camX, camY, vw, vh, t, ents, openId);

      display.imageSmoothingEnabled = false;
      display.drawImage(buffer, 0, 0, vw * scale, vh * scale);

      /* Crisp text layer */
      const S = scale;
      display.save();
      display.direction = 'rtl';
      display.textAlign = 'center';
      display.textBaseline = 'middle';
      for (const p of map.props) {
        if ((p.type !== 'sign' && p.type !== 'neon') || !p.text) continue;
        const sx = (p.x * T + (p.w * T) / 2 - camX) * S;
        const sy = (p.y * T + 7 - camY) * S;
        if (sx < -300 || sx > canvas.width + 300 || sy < -50 || sy > canvas.height + 50) continue;
        display.font = `700 ${Math.round(5.2 * S)}px Heebo, Arial, sans-serif`;
        if (p.type === 'neon') {
          display.shadowColor = p.color ?? '#f472b6';
          display.shadowBlur = 3 * S;
          display.fillStyle = '#fff5fb';
        } else {
          display.shadowBlur = 0;
          display.fillStyle = '#f1f5f9';
        }
        display.fillText(p.text, sx, sy, p.w * T * S - 4 * S);
      }
      display.shadowBlur = 0;
      for (const l of map.labels) {
        if (l.kind === 'room' && l.building !== openId) continue;
        const sx = (l.x * T - camX) * S;
        const sy = (l.y * T - camY) * S;
        if (sx < -300 || sx > canvas.width + 300 || sy < -50 || sy > canvas.height + 50) continue;
        display.font = `${l.kind === 'room' ? 700 : 800} ${Math.round((l.kind === 'room' ? 4.2 : 5.5) * S)}px Heebo, Arial, sans-serif`;
        display.fillStyle = l.kind === 'room' ? 'rgba(226,232,240,0.55)' : 'rgba(226,232,240,0.32)';
        display.fillText(l.text, sx, sy);
      }
      // Name tag over whatever is in reach.
      const near = L.paused ? null : nearest();
      if (near) {
        const tagY = near.kind === 'prop' ? near.p.y - (propDef(near.p).wall ? 0 : 0.6) : near.y - 1.75;
        const sx = (near.x * T - camX) * S;
        const sy = (tagY * T - camY) * S;
        display.font = `700 ${Math.round(4.6 * S)}px Heebo, Arial, sans-serif`;
        const w = display.measureText(near.name).width + 5 * S;
        display.fillStyle = 'rgba(10,14,20,0.82)';
        display.fillRect(sx - w / 2, sy - 3.6 * S, w, 7.2 * S);
        display.fillStyle = near.kind === 'prop' ? '#cbd5e1' : '#fcd34d';
        display.fillText(near.name, sx, sy + 0.3 * S);
      }
      display.restore();

      const verb = near ? (near.kind === 'prop' ? (near.p.facility ? 'שימוש' : 'בדיקה') : near.kind === 'hotspot' && !near.actor ? 'בדיקה' : 'שיחה') : '';
      const sig = near ? `${near.kind}:${near.name}:${verb}` : '';
      if (sig !== lastPrompt) {
        lastPrompt = sig;
        setPrompt(near ? { name: near.name, verb, kind: near.kind } : null);
      }

      if (now - lastSave > 1000) {
        lastSave = now;
        L.onPositionChange(map.id, Math.round(player.x * 100) / 100, Math.round(player.y * 100) / 100);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
    // The world is rebuilt only when the map or the player's look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, playerLook]);

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none overflow-hidden bg-[#07090c]" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="absolute inset-0 block" style={{ imageRendering: 'pixelated' }} />
      <div className="crt-overlay pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-noir-border bg-noir-bg/80 px-2.5 py-1 backdrop-blur">
        <div className="font-display text-sm font-bold leading-tight text-slate-100">{map.name}</div>
        <div className="text-[10px] text-steel">{map.district}</div>
      </div>
      {prompt && !paused && (
        <button
          onClick={() => interactRef.current()}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-evidence/60 bg-noir-panel/95 px-4 py-2.5 text-sm font-bold text-slate-100 shadow-lg active:scale-95"
        >
          {prompt.kind === 'prop' ? <Search className="h-4 w-4 text-steel" /> : prompt.verb === 'בדיקה' ? <Hand className="h-4 w-4 text-evidence-light" /> : <MessageSquare className="h-4 w-4 text-evidence-light" />}
          <span>{prompt.verb}</span>
          <span className="max-w-[46vw] truncate text-steel">{prompt.name}</span>
        </button>
      )}
    </div>
  );
}
