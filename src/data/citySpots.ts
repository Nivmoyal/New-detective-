// Free standing places around the city, found automatically from the map
// geometry: open pavement where a person can stand without blocking a path,
// a doorway or anyone else. Generated cases put their scenes, witnesses and
// suspects' homes here, and a few extra residents fill the streets.
import { MAPS, SCENE_MAP_IDS } from './maps';
import { INCIDENTS } from './incidents';
import { hashString, seeded } from '../pixel/color';
import { look } from '../pixel/world/builder';
import { nextPersona } from '../pixel/world/personas';
import { Tile, WALKABLE, type PixelMap } from '../pixel/world/types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP, type Dir } from '../pixel/person';

export interface Spot {
  anchor: string;
  mapId: string;
  x: number;
  y: number;
  /** The street or square it is on. */
  street: string;
}

const OUTDOOR = new Set<number>([Tile.Sidewalk, Tile.Concrete, Tile.Parking, Tile.Platform, Tile.Dirt, Tile.Grass]);

/** How each area is named in a sentence ("ליד הסמטה האחורית בפלורנטין"). */
export const AREA: Record<string, string> = {
  levinsky: 'בשוק לוינסקי',
  neveShaanan: 'בנווה שאנן',
  oldCbs: 'בתחנה המרכזית הישנה',
  florentin: 'בפלורנטין',
  shapira: 'בשפירא',
};

function reachable(m: PixelMap): Set<number> {
  const seen = new Set<number>();
  const extra = new Set<number>();
  for (const n of m.npcs) if (!n.path) extra.add(Math.floor(n.y) * m.w + Math.floor(n.x));
  for (const f of m.facilities) if (!f.object) extra.add(Math.floor(f.y) * m.w + Math.floor(f.x));
  const q = [Math.floor(m.spawn.y) * m.w + Math.floor(m.spawn.x)];
  while (q.length) {
    const k = q.pop()!;
    if (seen.has(k) || m.blocked[k] || extra.has(k)) continue;
    seen.add(k);
    const x = k % m.w;
    const y = (k - x) / m.w;
    if (x > 0) q.push(k - 1);
    if (x < m.w - 1) q.push(k + 1);
    if (y > 0) q.push(k - m.w);
    if (y < m.h - 1) q.push(k + m.w);
  }
  return seen;
}

function nearestStreet(m: PixelMap, x: number, y: number): string {
  let best = '';
  let bd = Infinity;
  for (const l of m.labels) {
    if (l.kind !== 'street') continue;
    const d = Math.hypot(l.x - x, l.y - y);
    if (d < bd) {
      bd = d;
      best = l.text;
    }
  }
  return best;
}

function findSpots(m: PixelMap): { x: number; y: number }[] {
  const reach = reachable(m);
  const people: [number, number][] = [
    ...m.npcs.filter((n) => !n.path).map((n) => [n.x, n.y] as [number, number]),
    ...m.facilities.map((f) => [f.x, f.y] as [number, number]),
    ...Object.values(m.anchors).map((a) => [a.x, a.y] as [number, number]),
    ...INCIDENTS.filter((i) => i.mapId === m.id).flatMap((i) => [[i.x, i.y] as [number, number], ...(i.extras ?? []).map((e) => [e.x, e.y] as [number, number])]),
  ];
  const route: [number, number][] = [];
  for (const n of m.npcs)
    if (n.path)
      for (let i = 0; i < n.path.length; i++) {
        const a = n.path[i];
        const b = n.path[(i + 1) % n.path.length];
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.25) || 1;
        for (let k = 0; k <= steps; k++) route.push([a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps]);
      }
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h && WALKABLE.has(m.tiles[y * m.w + x]) && !m.blocked[y * m.w + x];
  const out: { x: number; y: number }[] = [];
  for (let y = 2; y < m.h - 2; y++)
    for (let x = 2; x < m.w - 2; x++) {
      const k = y * m.w + x;
      if (!OUTDOOR.has(m.tiles[k]) || !reach.has(k)) continue;
      // Open on every side, so a person standing here never blocks the way.
      let ok = true;
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1 && ok; i++) if (!open(x + i, y + j)) ok = false;
      if (!ok) continue;
      // Never in front of a doorway.
      if (m.tiles[(y - 1) * m.w + x] === Tile.Door || m.tiles[(y - 2) * m.w + x] === Tile.Door) continue;
      const px = x + 0.5;
      const py = y + 0.6;
      if (people.some(([ax, ay]) => Math.hypot(ax - px, ay - py) < 1.7)) continue;
      if (route.some(([ax, ay]) => Math.hypot(ax - px, ay - py) < 1.1)) continue;
      out.push({ x: px, y: py });
    }
  return out;
}

const EXTRA_NAMES = {
  male: ['אבי', 'שמעון', 'יגאל', 'רפי', 'דוד', 'אלי', 'ניסים', 'קובי', 'גבי', 'עמית', 'אסף', 'ליאור'],
  female: ['שושי', 'אורנה', 'מזל', 'ציפי', 'חני', 'ורד', 'רינה', 'אתי', 'נעמה', 'הילה', 'קרן', 'מלכה'],
};
const SKINS = ['#f3d2b3', '#e5b48f', '#c98f66', '#9c6644', '#6b4430'];
const HAIRS = ['#16120f', '#3b2618', '#6b4423', '#a8743f', '#bdb6ad'];
const TOPS = ['#7a1f25', '#1e3a8a', '#3d5a3a', '#6b7280', '#a16207', '#5a2d4a', '#0f766e', '#c2410c'];

const spots: Record<string, Spot[]> = {};
let prepared = false;

/**
 * Find the free places on every street map, register them as anchors
 * ("auto-<map>-<n>") and put a few extra residents on the streets.
 * Safe to call any number of times.
 */
export function prepareCity() {
  if (prepared) return;
  prepared = true;
  for (const mapId of SCENE_MAP_IDS) {
    const m = MAPS[mapId];
    const rnd = seeded(hashString(`spots:${mapId}`));
    const all = findSpots(m);
    // Spread out: shuffle, then keep points at least 2.4 tiles apart.
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const picked: { x: number; y: number }[] = [];
    for (const p of all) if (!picked.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 2.4)) picked.push(p);
    // Every seventh place gets a resident who just lives there.
    const list: Spot[] = [];
    picked.forEach((p, i) => {
      if (i % 7 === 3) {
        // Each resident is their own person, with their own things to say.
        const who = nextPersona(rnd() < 0.55 ? 'resident' : 'street', undefined, () => rnd() < 0.5);
        const g = who.female ? 'female' : 'male';
        const hair = who.female ? (['long', 'bun', 'ponytail', 'curly'] as const) : (['short', 'buzz', 'bald', 'curly'] as const);
        const dirs: Dir[] = [DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP];
        m.npcs.push({
          id: `${mapId}-resident-${i}`,
          x: p.x,
          y: p.y,
          dir: dirs[Math.floor(rnd() * 3)],
          name: EXTRA_NAMES[g][Math.floor(rnd() * EXTRA_NAMES[g].length)],
          role: who.role,
          look: look(g, SKINS[Math.floor(rnd() * SKINS.length)], hair[Math.floor(rnd() * hair.length)], HAIRS[Math.floor(rnd() * HAIRS.length)], (['tshirt', 'hoodie', 'blazer', 'apron', 'vest'] as const)[Math.floor(rnd() * 5)], TOPS[Math.floor(rnd() * TOPS.length)], '#22252b', { glasses: rnd() < 0.2, beard: !who.female && rnd() < 0.3 }),
          lines: who.lines,
          done: who.done,
        });
        return;
      }
      const anchor = `auto-${mapId}-${list.length}`;
      m.anchors[anchor] = { x: p.x, y: p.y, dir: DIR_DOWN };
      list.push({ anchor, mapId, x: p.x, y: p.y, street: nearestStreet(m, p.x, p.y) });
    });
    spots[mapId] = list;
  }
}

export function citySpots(mapId: string): Spot[] {
  prepareCity();
  return spots[mapId] ?? [];
}

/** A place name for a sentence: "רחוב וושינגטון", "הסמטה האחורית בפלורנטין". */
const DEFINITE: Record<string, string> = {
  'סמטה אחורית': 'הסמטה האחורית',
  'חניון': 'החניון',
  'תחנת מוניות': 'תחנת המוניות',
  'רציפים 1-4': 'הרציפים',
  'רמפה לחניון התחתון': 'הרמפה לחניון התחתון',
  'מחסנים להשכרה': 'מתחם המחסנים',
};

export function placeName(spot: Spot): string {
  const s = DEFINITE[spot.street] ?? spot.street;
  if (!s) return `רחוב צדדי ${AREA[spot.mapId]}`;
  if (s.startsWith('רחוב') || s.startsWith('גינת') || s.startsWith('כיכר') || s.startsWith('שוק') || s.startsWith('מדרחוב')) return s;
  return `${s} ${AREA[spot.mapId]}`;
}
