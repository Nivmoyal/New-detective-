// Validates map geometry (reachability of every person, place and object)
// and case data integrity. Run with: npm run validate:data
import casesData from '../src/data/cases/cases.json';
import { MAPS } from '../src/data/maps';
import { FACILITY_CHARACTERS } from '../src/data/characters';
import { INCIDENTS } from '../src/data/incidents';
import { generateCase } from '../src/services/caseGenerator';
import type { CaseFile, CasesFile } from '../src/types/investigation';
import { Tile, type PixelMap } from '../src/pixel/world/types';

const errors: string[] = [];
const data = casesData as unknown as CasesFile;

function reachable(m: PixelMap): Set<number> {
  const seen = new Set<number>();
  const blocked = new Set<number>();
  // Standing people block their tile.
  for (const n of m.npcs) if (!n.path) blocked.add(Math.floor(n.y) * m.w + Math.floor(n.x));
  for (const f of m.facilities) if (!f.object) blocked.add(Math.floor(f.y) * m.w + Math.floor(f.x));
  const start = Math.floor(m.spawn.y) * m.w + Math.floor(m.spawn.x);
  const q = [start];
  while (q.length) {
    const k = q.pop()!;
    if (seen.has(k) || m.blocked[k] || blocked.has(k)) continue;
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

function nearReachable(m: PixelMap, reach: Set<number>, x: number, y: number, range: number) {
  for (const k of reach) {
    const tx = (k % m.w) + 0.5;
    const ty = Math.floor(k / m.w) + 0.6;
    if (Math.hypot(tx - x, ty - y) <= range) return true;
  }
  return false;
}

const reach: Record<string, Set<number>> = {};
for (const m of Object.values(MAPS)) {
  const r = reachable(m);
  reach[m.id] = r;
  if (!r.size) errors.push(`${m.id}: spawn ${m.spawn.x},${m.spawn.y} is blocked`);
  for (const f of m.facilities) {
    if (!f.object && !FACILITY_CHARACTERS[f.id]) errors.push(`${m.id}: facility ${f.id} has no character`);
    if (!nearReachable(m, r, f.x, f.y, 1.9)) errors.push(`${m.id}: facility ${f.id} out of reach`);
  }
  for (const n of m.npcs) {
    if (!nearReachable(m, r, n.x, n.y, 1.9)) errors.push(`${m.id}: npc ${n.name} out of reach`);
    if (!n.path && m.blocked[Math.floor(n.y) * m.w + Math.floor(n.x)]) errors.push(`${m.id}: npc ${n.name} stands inside a wall/prop`);
    if (n.path)
      for (let i = 0; i < n.path.length; i++) {
        const a = n.path[i];
        const b = n.path[(i + 1) % n.path.length];
        for (let t = 0, dt = 0.2 / (Math.hypot(b.x - a.x, b.y - a.y) || 1); t <= 1; t += dt) {
          const x = Math.floor(a.x + (b.x - a.x) * t);
          const y = Math.floor(a.y + (b.y - a.y) * t);
          if (m.blocked[y * m.w + x]) {
            errors.push(`${m.id}: walker ${n.name} crosses a blocked tile at ${x},${y}`);
            break;
          }
          const px = a.x + (b.x - a.x) * t;
          const py = a.y + (b.y - a.y) * t;
          const standing = m.npcs.find((o) => !o.path && Math.hypot(o.x - px, o.y - py) < 0.7);
          if (standing) {
            errors.push(`${m.id}: walker ${n.name} walks through ${standing.name}`);
            break;
          }
        }
      }
  }
  for (const p of m.props) {
    if (p.type === 'shutter' || p.type === 'storageDoor' || p.type === 'sign' || p.type === 'neon' || p.type === 'window' || p.type === 'ac' || p.type === 'graffiti' || p.type === 'poster') continue;
    if (p.facility && !m.facilities.some((f) => f.id === p.facility)) errors.push(`${m.id}: prop ${p.name} uses unknown facility ${p.facility}`);
    if (p.facility && !nearReachable(m, r, p.x + p.w / 2, p.y + p.h / 2, 1.6)) errors.push(`${m.id}: facility prop ${p.name} out of reach`);
  }
  for (const [name, a] of Object.entries(m.anchors)) {
    if (a.x < 0 || a.y < 0 || a.x >= m.w || a.y >= m.h) errors.push(`${m.id}: anchor ${name} outside the map`);
  }
}

for (const inc of INCIDENTS) {
  const m = MAPS[inc.mapId];
  if (!m) {
    errors.push(`incident ${inc.id}: unknown map`);
    continue;
  }
  for (const p of [{ x: inc.x, y: inc.y, name: inc.person.name }, ...(inc.extras ?? [])]) {
    if (m.blocked[Math.floor(p.y) * m.w + Math.floor(p.x)]) errors.push(`incident ${inc.id}: ${p.name} stands inside a wall/prop`);
    if (!nearReachable(m, reach[m.id], p.x, p.y, 1.9)) errors.push(`incident ${inc.id}: ${p.name} out of reach`);
    for (const n of m.npcs) {
      if (!n.path && Math.hypot(n.x - p.x, n.y - p.y) < 0.9) errors.push(`incident ${inc.id}: ${p.name} overlaps ${n.name}`);
      if (n.path)
        for (let i = 0; i < n.path.length; i++) {
          const a = n.path[i];
          const b = n.path[(i + 1) % n.path.length];
          for (let t = 0, dt = 0.2 / (Math.hypot(b.x - a.x, b.y - a.y) || 1); t <= 1; t += dt)
            if (Math.hypot(a.x + (b.x - a.x) * t - p.x, a.y + (b.y - a.y) * t - p.y) < 0.7) {
              errors.push(`incident ${inc.id}: walker ${n.name} walks through ${p.name}`);
              t = 2;
            }
        }
    }
  }
}

const emoji = /\p{Extended_Pictographic}/u;
if (emoji.test(JSON.stringify(INCIDENTS))) errors.push('incidents contain emoji');
if (emoji.test(JSON.stringify(data))) errors.push('cases.json contains emoji');
const usedAnchors = new Set<string>();
// The generator cycles through its sites and templates; 60 cases cover every combination several times.
const GENERATED = 60;
const generated: CaseFile[] = [];
for (let n = 1; n <= GENERATED; n++) generated.push(generateCase(n));
for (const c of generated) {
  const text = JSON.stringify(c);
  if (emoji.test(text)) errors.push(`${c.id}: emoji in generated text`);
  const leftover = text.match(/\{[^{}"]*\}/);
  if (leftover) errors.push(`${c.id}: unresolved placeholder ${leftover[0]}`);
  if (generateCase(c.id === 'gen-1' ? 1 : Number(c.id.slice(4))).culpritId !== c.culpritId) errors.push(`${c.id}: generator is not deterministic`);
  if (new Set(c.suspects.map((s) => s.name)).size !== c.suspects.length) errors.push(`${c.id}: two suspects share a name`);
}
for (const c of [...data.cases, ...generated]) {
  const sus = new Set(c.suspects.map((s) => s.id));
  const clues = new Map(c.clues.map((e) => [e.id, e]));
  if (!sus.has(c.culpritId)) errors.push(`${c.id}: culprit missing`);
  for (const e of c.clues) {
    [...e.implicates, ...e.clears].forEach((s) => !sus.has(s) && errors.push(`${c.id}/${e.id}: unknown suspect ${s}`));
    if (e.requiresLab && !e.labResult) errors.push(`${c.id}/${e.id}: lab item without result`);
  }
  const obtainable = new Set<string>();
  for (const h of c.hotspots) {
    const m = MAPS[h.mapId];
    if (!m) {
      errors.push(`${c.id}/${h.id}: unknown map ${h.mapId}`);
      continue;
    }
    const a = m.anchors[h.anchor];
    usedAnchors.add(`${h.mapId}:${h.anchor}`);
    if (!a) errors.push(`${c.id}/${h.id}: anchor ${h.anchor} missing on ${h.mapId}`);
    else {
      const range = h.character ? 1.9 : 1.2;
      if (!nearReachable(m, reach[m.id], a.x, a.y, range)) errors.push(`${c.id}/${h.id}: anchor ${h.anchor} out of reach`);
      if (h.character && m.blocked[Math.floor(a.y) * m.w + Math.floor(a.x)]) errors.push(`${c.id}/${h.id}: character stands inside a wall/prop`);
    }
    if (h.requires?.length && !h.lockedText) errors.push(`${c.id}/${h.id}: locked lead without lockedText`);
    h.evidenceIds.forEach((id) => {
      if (!clues.has(id)) errors.push(`${c.id}/${h.id}: unknown evidence ${id}`);
      obtainable.add(id);
    });
    (h.requires ?? []).forEach((id) => !clues.has(id) && errors.push(`${c.id}/${h.id}: unknown requirement ${id}`));
  }
  c.clues.forEach((e) => !obtainable.has(e.id) && errors.push(`${c.id}/${e.id}: not obtainable from any hotspot`));
  const culpritHits = c.clues.filter((e) => e.implicates.includes(c.culpritId)).length;
  if (culpritHits < 3) errors.push(`${c.id}: culprit implicated by only ${culpritHits} items`);
  for (const s of c.suspects) {
    if (s.id === c.culpritId) continue;
    const hits = c.clues.filter((e) => e.implicates.includes(s.id)).length;
    if (hits >= 3) errors.push(`${c.id}: innocent ${s.id} implicated ${hits} times (could get a warrant)`);
    if (!c.clues.some((e) => e.clears.includes(s.id))) errors.push(`${c.id}: innocent ${s.id} can never be cleared`);
  }
  const culprit = c.suspects.find((s) => s.id === c.culpritId);
  if (!culprit?.interrogation) errors.push(`${c.id}: culprit has no interrogation profile`);
  culprit?.interrogation?.keyEvidence.forEach((id) => !clues.has(id) && errors.push(`${c.id}: unknown key evidence ${id}`));
  const got = new Set<string>();
  const pending = [...c.hotspots];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let i = pending.length - 1; i >= 0; i--) {
      if ((pending[i].requires ?? []).every((r) => got.has(r))) {
        pending[i].evidenceIds.forEach((e) => got.add(e));
        pending.splice(i, 1);
        progressed = true;
      }
    }
  }
  pending.forEach((h) => errors.push(`${c.id}/${h.id}: requirements never satisfiable`));
}

// Generated-case places must not stand on top of anyone else in the world.
for (const m of Object.values(MAPS)) {
  const gen = Object.entries(m.anchors).filter(([k]) => k.startsWith('gen-') || k.startsWith('auto-') || k === 'st-archive');
  const others = Object.entries(m.anchors).filter(([k]) => !gen.some(([g]) => g === k));
  const people = [
    ...m.npcs.filter((n) => !n.path).map((n) => ({ name: n.name, x: n.x, y: n.y })),
    ...INCIDENTS.filter((i) => i.mapId === m.id).map((i) => ({ name: `incident ${i.id}`, x: i.x, y: i.y })),
    ...others.map(([k, a]) => ({ name: `anchor ${k}`, x: a.x, y: a.y })),
    ...gen.map(([k, a]) => ({ name: `anchor ${k}`, x: a.x, y: a.y })),
  ];
  for (const [k, a] of gen) {
    for (const o of people) if (o.name !== `anchor ${k}` && Math.hypot(o.x - a.x, o.y - a.y) < 1) errors.push(`${m.id}: ${k} overlaps ${o.name}`);
    for (const n of m.npcs)
      if (n.path)
        for (let i = 0; i < n.path.length; i++) {
          const p = n.path[i];
          const q = n.path[(i + 1) % n.path.length];
          for (let t = 0, dt = 0.2 / (Math.hypot(q.x - p.x, q.y - p.y) || 1); t <= 1; t += dt)
            if (Math.hypot(p.x + (q.x - p.x) * t - a.x, p.y + (q.y - p.y) * t - a.y) < 0.7) {
              errors.push(`${m.id}: walker ${n.name} walks through ${k}`);
              t = 2;
            }
        }
  }
}

// Nobody stands in a doorway: with every person in the world in place (staff,
// passers-by, case witnesses of every case, street situations), every door
// must still be walkable and lead somewhere.
for (const m of Object.values(MAPS)) {
  const people: { x: number; y: number; who: string }[] = [
    ...m.npcs.filter((n) => !n.path).map((n) => ({ x: n.x, y: n.y, who: n.name })),
    ...m.facilities.filter((f) => !f.object).map((f) => ({ x: f.x, y: f.y, who: f.label })),
    ...INCIDENTS.filter((i) => i.mapId === m.id).flatMap((i) => [{ x: i.x, y: i.y, who: i.person.name }, ...(i.extras ?? []).map((e) => ({ x: e.x, y: e.y, who: e.name }))]),
  ];
  for (const c of [...data.cases, ...generated])
    for (const h of c.hotspots)
      if (h.mapId === m.id && h.character && m.anchors[h.anchor]) people.push({ x: m.anchors[h.anchor].x, y: m.anchors[h.anchor].y, who: `${h.character.name} (${c.id})` });
  // Same collision test the game uses: the player at the tile centre bumps into a person nearby.
  const standsOn = (tx: number, ty: number) => people.find((a) => Math.hypot(a.x - (tx + 0.5), (a.y - (ty + 0.5)) * 1.4) < 0.75);
  const seen = new Set<number>();
  const q = [Math.floor(m.spawn.y) * m.w + Math.floor(m.spawn.x)];
  while (q.length) {
    const k = q.pop()!;
    const x = k % m.w;
    const y = (k - x) / m.w;
    if (seen.has(k) || m.blocked[k] || (seen.size > 0 && standsOn(x, y))) continue;
    seen.add(k);
    if (x > 0) q.push(k - 1);
    if (x < m.w - 1) q.push(k + 1);
    if (y > 0) q.push(k - m.w);
    if (y < m.h - 1) q.push(k + m.w);
  }
  // Nobody cuts off a corridor either: everything walkable stays reachable.
  const cut: string[] = [];
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const k = y * m.w + x;
      if (m.blocked[k] || seen.has(k) || standsOn(x, y)) continue;
      // Ignore pockets that were never reachable anyway (behind props, inside solid blocks).
      if (!reach[m.id].has(k)) continue;
      cut.push(`${x},${y}`);
    }
  if (cut.length) errors.push(`${m.id}: ${cut.length} tiles cut off by people standing in the way, e.g. ${cut.slice(0, 4).join(' ')}`);
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = m.tiles[y * m.w + x];
      if (t !== Tile.Door && t !== Tile.DoorTop) continue;
      // A doorway joins two sides: across it (up/down or left/right) both
      // neighbours must be open and reachable.
      const ok = (i: number, j: number) => i >= 0 && j >= 0 && i < m.w && j < m.h && seen.has(j * m.w + i);
      const through = (ok(x, y - 1) && ok(x, y + 1)) || (ok(x - 1, y) && ok(x + 1, y));
      if (seen.has(y * m.w + x) && through) continue;
      const near = people.filter((a) => Math.hypot(a.x - (x + 0.5), a.y - (y + 0.5)) < 2.5).map((a) => a.who);
      errors.push(`${m.id}: doorway at ${x},${y} can't be walked through${near.length ? ` (in the way: ${near.join(', ')})` : ''}`);
    }
}

// Nobody in the city repeats someone else's words.
{
  const said = new Map<string, string>();
  for (const m of Object.values(MAPS))
    for (const n of m.npcs)
      for (const line of [...n.lines, ...(n.done ? [n.done] : [])]) {
        const who = `${m.id}/${n.name}`;
        const other = said.get(line);
        if (other && other !== who) errors.push(`${who} repeats a line of ${other}: ${line}`);
        said.set(line, who);
        if (/\{s:/.test(line)) errors.push(`${who}: unresolved speaker marker in "${line}"`);
      }
  for (const m of Object.values(MAPS)) for (const n of m.npcs) if (n.lines.length < 2) errors.push(`${m.id}/${n.name} has almost nothing to say`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const props = Object.values(MAPS).reduce((n, m) => n + m.props.length, 0);
const npcs = Object.values(MAPS).reduce((n, m) => n + m.npcs.length, 0);
console.log(`OK: ${Object.keys(MAPS).length} maps (${props} objects, ${npcs} background characters), ${data.cases.length} story cases + ${GENERATED} generated, ${usedAnchors.size} case locations validated.`);
