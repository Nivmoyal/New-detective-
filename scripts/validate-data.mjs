// Validates map geometry and case data integrity.
// Run with: node --experimental-strip-types scripts/validate-data.mjs
import { readFileSync } from 'node:fs';
import { MAPS, WALKABLE_TILES } from '../src/data/maps.ts';
import { CHAT_NPCS, PEDESTRIANS } from '../src/data/characters.ts';

const errors = [];
const tile = (m, x, y) => (m.tiles[Math.floor(y)] ?? '')[Math.floor(x)] ?? '#';

function reachable(m) {
  const seen = new Set();
  const q = [[Math.floor(m.spawn.x), Math.floor(m.spawn.y)]];
  while (q.length) {
    const [x, y] = q.pop();
    const k = `${x},${y}`;
    if (seen.has(k) || !WALKABLE_TILES.has(tile(m, x, y))) continue;
    seen.add(k);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

const reach = {};
for (const m of Object.values(MAPS)) {
  const w = m.tiles[0].length;
  m.tiles.forEach((r, i) => r.length !== w && errors.push(`${m.id} row ${i} length ${r.length} != ${w}`));
  reach[m.id] = reachable(m);
  const check = (label, x, y) => {
    if (!reach[m.id].has(`${Math.floor(x)},${Math.floor(y)}`)) errors.push(`${m.id}: ${label} at ${x},${y} not reachable (tile '${tile(m, x, y)}')`);
  };
  check('spawn', m.spawn.x, m.spawn.y);
  m.facilities.forEach((f) => check(f.id, f.x, f.y));
}

for (const n of CHAT_NPCS) {
  if (!reach[n.mapId]?.has(`${Math.floor(n.x)},${Math.floor(n.y)}`)) errors.push(`chat npc ${n.id} not reachable`);
}
for (const p of PEDESTRIANS) {
  const m = MAPS[p.mapId];
  for (let i = 0; i < p.path.length; i++) {
    const a = p.path[i], b = p.path[(i + 1) % p.path.length];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
      if (!WALKABLE_TILES.has(tile(m, x, y))) { errors.push(`pedestrian on ${p.mapId} crosses '${tile(m, x, y)}' at ${x.toFixed(1)},${y.toFixed(1)}`); break; }
    }
  }
}

const data = JSON.parse(readFileSync(new URL('../src/data/cases/cases.json', import.meta.url), 'utf8'));
const emoji = /\p{Extended_Pictographic}/u;
if (emoji.test(JSON.stringify(data))) errors.push('cases.json contains emoji');
for (const c of data.cases) {
  const sus = new Set(c.suspects.map((s) => s.id));
  const clues = new Map(c.clues.map((e) => [e.id, e]));
  if (!sus.has(c.culpritId)) errors.push(`${c.id}: culprit missing`);
  for (const e of c.clues) {
    [...e.implicates, ...e.clears].forEach((s) => !sus.has(s) && errors.push(`${c.id}/${e.id}: unknown suspect ${s}`));
    if (e.requiresLab && !e.labResult) errors.push(`${c.id}/${e.id}: lab item without result`);
  }
  const reachableClues = new Set();
  for (const h of c.hotspots) {
    if (!MAPS[h.mapId]) { errors.push(`${c.id}/${h.id}: unknown map ${h.mapId}`); continue; }
    if (!reach[h.mapId].has(`${Math.floor(h.x)},${Math.floor(h.y)}`)) errors.push(`${c.id}/${h.id}: hotspot ${h.x},${h.y} not reachable on ${h.mapId} ('${tile(MAPS[h.mapId], h.x, h.y)}')`);
    h.evidenceIds.forEach((id) => { if (!clues.has(id)) errors.push(`${c.id}/${h.id}: unknown evidence ${id}`); reachableClues.add(id); });
    (h.requires ?? []).forEach((id) => !clues.has(id) && errors.push(`${c.id}/${h.id}: unknown requirement ${id}`));
  }
  c.clues.forEach((e) => !reachableClues.has(e.id) && errors.push(`${c.id}/${e.id}: not obtainable from any hotspot`));
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
  // Hotspot dependency chains must be resolvable.
  const got = new Set();
  let progressed = true;
  const pending = [...c.hotspots];
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

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${Object.keys(MAPS).length} maps, ${data.cases.length} cases validated.`);
