// Headless playthrough of every case through the real game reducer.
import { gameReducer, initialState, type GameState, type GameAction } from '../src/state/gameReducer';
import { getCase, evaluateDeduction, loadCases, validateLink, isHotspotAvailable, emptyProgress } from '../src/services/caseEngine';
import { defaultPlayerLook } from '../src/data/characters';

const fail = (msg: string) => {
  throw new Error(msg);
};
let s: GameState = initialState();
const d = (a: GameAction) => (s = gameReducer(s, a));
d({ type: 'CREATE_PROFILE', name: 'בודק', specialization: 'intel', addressForm: 'female', look: defaultPlayerLook('female') });

// Freedom: evidence can be gathered before reporting anywhere, and lands in its own case.
const third = loadCases()[2];
const firstOpenSpot = third.hotspots.find((h) => !h.requires?.length)!;
d({ type: 'VISIT_HOTSPOT', caseId: third.id, hotspotId: firstOpenSpot.id });
if (!s.progress[third.id]?.collected.length) fail('evidence before the briefing was not recorded');
if (s.activeCaseId !== third.id) fail('first touched case should become the focus');

// Locked leads stay locked until their requirement is in hand.
const locked = third.hotspots.find((h) => h.requires?.length && !isHotspotAvailable(h, s.progress[third.id]))!;
const before = s.progress[third.id].collected.length;
d({ type: 'VISIT_HOTSPOT', caseId: third.id, hotspotId: locked.id });
if (s.progress[third.id].collected.length !== before) fail('locked lead yielded evidence');

// Decisions with a price: an early warrant opens a locked lead for 10 reliability,
// pressing a witness costs 6 - tried on a copy, the real playthrough goes on untouched.
{
  let t = s;
  const rel = t.profile!.reliability;
  t = gameReducer(t, { type: 'FORCE_HOTSPOT', caseId: third.id, hotspotId: locked.id });
  if (!isHotspotAvailable(locked, t.progress[third.id]) || t.profile!.reliability !== rel - 10) fail('early warrant did not open the lead at its price');
  t = gameReducer(t, { type: 'PRESS_WITNESS', caseId: third.id, hotspotId: locked.id });
  t = gameReducer(t, { type: 'PRESS_WITNESS', caseId: third.id, hotspotId: locked.id });
  if (t.profile!.reliability !== rel - 16) fail('pressing a witness should cost once');
  t = { ...t, profile: { ...t.profile!, reliability: 30 } };
  const other = third.hotspots.find((h) => h.requires?.length && h.id !== locked.id);
  if (other) {
    t = gameReducer(t, { type: 'FORCE_HOTSPOT', caseId: third.id, hotspotId: other.id });
    if (t.progress[third.id].forced?.includes(other.id)) fail('commander signed an early warrant at low reliability');
  }
}

d({ type: 'ARRIVAL_COMMANDER_DONE' });
d({ type: 'OPEN_CASE_FILES' });
if (Object.keys(s.progress).length !== loadCases().filter((c) => !c.unlockAfter).length) fail('not every open case was opened');

// Play far beyond the story: generated cases keep landing on the desk.
const TARGET = 25;
const nextCase = () => loadCases().find((c) => !s.profile!.solvedCases.includes(c.id) && (c.unlockAfter ?? 0) <= s.profile!.solvedCases.length);
for (let c = nextCase(); c && s.profile!.solvedCases.length < TARGET; c = nextCase()) {
  const open = loadCases().filter((x) => !s.profile!.solvedCases.includes(x.id) && (x.unlockAfter ?? 0) <= s.profile!.solvedCases.length);
  if (open.length < 2) fail(`only ${open.length} open cases after ${s.profile!.solvedCases.length} solved`);
  if ((c.unlockAfter ?? 0) > s.profile!.solvedCases.length) fail(`${c.id}: still locked after ${s.profile!.solvedCases.length} solved`);
  d({ type: 'FOCUS_CASE', caseId: c.id });
  // A premature warrant request is refused and costs reliability.
  const rel = s.profile!.reliability;
  d({ type: 'REQUEST_WARRANT', suspectId: c.culpritId });
  if (s.progress[c.id].warrantSuspectId) fail(`${c.id}: warrant granted without evidence`);
  if (s.profile!.reliability >= rel) fail(`${c.id}: no penalty for a baseless warrant request`);
  for (let pass = 0; pass < 5; pass++)
    for (const h of c.hotspots) {
      const p = s.progress[c.id] ?? emptyProgress();
      if (isHotspotAvailable(h, p)) d({ type: 'VISIT_HOTSPOT', caseId: c.id, hotspotId: h.id });
    }
  d({ type: 'ANALYZE_LAB' });
  const p = s.progress[c.id];
  if (p.collected.length !== c.clues.length) fail(`${c.id}: collected ${p.collected.length}/${c.clues.length}`);
  for (const sus of c.suspects)
    for (const e of p.collected) {
      const v = validateLink(c, sus.id, e);
      if (v !== 'invalid') d({ type: 'LINK_RESULT', suspectId: sus.id, evidenceId: e, verdict: v });
    }
  const ded = evaluateDeduction(c, s.progress[c.id]);
  const target = ded.find((x) => x.canIssueWarrant);
  if (!target || target.suspectId !== c.culpritId || ded.filter((x) => x.canIssueWarrant).length !== 1)
    fail(`${c.id}: bad deduction ${JSON.stringify(ded)}`);
  d({ type: 'REQUEST_WARRANT', suspectId: target.suspectId });
  if (s.progress[c.id].warrantSuspectId !== c.culpritId) fail(`${c.id}: justified warrant refused`);
  d({ type: 'START_INTERROGATION', caseId: c.id });
  const key = c.suspects.find((x) => x.id === c.culpritId)!.interrogation!.keyEvidence;
  const others = c.clues.filter((x) => x.implicates.includes(c.culpritId) && !key.includes(x.id)).map((x) => x.id);
  const plan: GameAction[] = [
    { type: 'INTERROGATION_ACTION', tactic: 'trust' },
    { type: 'INTERROGATION_ACTION', tactic: 'trust' },
    ...key.map((e) => ({ type: 'INTERROGATION_ACTION', tactic: 'evidence', evidenceId: e }) as GameAction),
    { type: 'INTERROGATION_ACTION', tactic: 'confront' },
    ...others.map((e) => ({ type: 'INTERROGATION_ACTION', tactic: 'evidence', evidenceId: e }) as GameAction),
  ];
  for (const a of plan) if (s.interrogation?.status === 'active') d(a);
  const it = s.interrogation!;
  console.log(`${c.id}: status=${it.status} turns=${it.turn} tension=${it.tension} coop=${it.cooperation} progress=${it.progress}`);
  if (it.status !== 'confessed') fail(it.log.map((l) => l.text).join('\n'));
  d({ type: 'END_INTERROGATION' });
  d({ type: 'DISMISS_PROMOTION' });
}
console.log('rank', s.profile!.rankIndex, 'solved', s.profile!.solvedCases.length, 'intel', s.profile!.intelPoints, 'rel', s.profile!.reliability);
if (s.profile!.solvedCases.length !== TARGET) fail(`solved ${s.profile!.solvedCases.length}, expected ${TARGET}`);
if (s.profile!.rankIndex !== 6) fail('rank did not keep climbing past the story cases');
// The phone: the lab calls about evidence, the commander about closed cases.
const from = (name: string) => s.messages.filter((m) => m.from === name).length;
if (!from('ד״ר מאיה שטרן')) fail('the lab never called');
if (from('סנ״צ אורנה ברק') < 5) fail('the commander did not message after closed cases');
if (s.messages.length > 40) fail('the phone keeps more than 40 messages');
if (s.messages.some((m) => /[{}]/.test(m.text))) fail('a phone message has an unresolved marker');
console.log('phone:', s.messages.length, 'messages, e.g.', s.messages[s.messages.length - 1].from, '-', s.messages[s.messages.length - 1].text);

// Failure path: pure pressure should drive a suspect to demand a lawyer.
let f = initialState();
f = gameReducer(f, { type: 'CREATE_PROFILE', name: 'x', specialization: 'intel', addressForm: 'male', look: defaultPlayerLook('male') });
f = gameReducer(f, { type: 'OPEN_CASE_FILES' });
f = gameReducer(f, { type: 'FOCUS_CASE', caseId: 'case-levinsky' });
f = { ...f, progress: { ...f.progress, 'case-levinsky': { ...f.progress['case-levinsky'], warrantSuspectId: 's-roni' } } };
f = gameReducer(f, { type: 'START_INTERROGATION' });
for (let i = 0; i < 10 && f.interrogation!.status === 'active'; i++) f = gameReducer(f, { type: 'INTERROGATION_ACTION', tactic: 'pressure' });
console.log('pressure-only outcome:', f.interrogation!.status);

// Variety: a long interrogation never repeats a line, whatever the detective tries.
{
  const variety = [...loadCases().filter((c) => !c.generated), ...Array.from({ length: 12 }, (_, i) => getCase(`gen-${i + 1}`))];
  for (const c of variety) {
    let v = initialState();
    v = gameReducer(v, { type: 'CREATE_PROFILE', name: 'x', specialization: 'intel', addressForm: 'male', look: defaultPlayerLook('male') });
    v = { ...v, arrivalStep: 'done', activeCaseId: c.id, progress: { [c.id]: { ...emptyProgress(), collected: c.clues.map((x) => x.id), analyzed: c.clues.map((x) => x.id), warrantSuspectId: c.culpritId } } };
    v = gameReducer(v, { type: 'START_INTERROGATION', caseId: c.id });
    // Gentle pacing so the session lasts as long as possible.
    const order: GameAction[] = [];
    for (const e of c.clues.filter((x) => !x.implicates.includes(c.culpritId) && !x.clears.includes(c.culpritId)))
      order.push({ type: 'INTERROGATION_ACTION', tactic: 'evidence', evidenceId: e.id });
    for (let i = 0; i < 12; i++) order.splice(i * 2, 0, { type: 'INTERROGATION_ACTION', tactic: i % 2 ? 'trust' : 'pressure' });
    for (const a of order) if (v.interrogation?.status === 'active') v = gameReducer(v, a);
    const spoken = v.interrogation!.log.filter((l) => l.speaker !== 'system').map((l) => l.text);
    if (spoken.some((t) => !t.trim() || /[{}]/.test(t))) fail(`${c.id}: empty or unresolved interrogation line`);
    const dupes = spoken.filter((t, i) => spoken.indexOf(t) !== i);
    if (dupes.length) fail(`${c.id}: repeated lines in interrogation: ${dupes.join(' | ')}`);
    console.log(`${c.id}: ${spoken.length} lines, no repeats (${v.interrogation!.status})`);
  }
}
