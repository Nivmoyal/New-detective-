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

d({ type: 'ARRIVAL_COMMANDER_DONE' });
d({ type: 'OPEN_CASE_FILES' });
if (Object.keys(s.progress).length !== loadCases().length) fail('not every case was opened');

for (const c of loadCases()) {
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
if (s.profile!.solvedCases.length !== 3) fail('not all cases solved');

// Failure path: pure pressure should drive a suspect to demand a lawyer.
let f = initialState();
f = gameReducer(f, { type: 'CREATE_PROFILE', name: 'x', specialization: 'intel', addressForm: 'male', look: defaultPlayerLook('male') });
f = gameReducer(f, { type: 'OPEN_CASE_FILES' });
f = gameReducer(f, { type: 'FOCUS_CASE', caseId: 'case-levinsky' });
f = { ...f, progress: { ...f.progress, 'case-levinsky': { ...f.progress['case-levinsky'], warrantSuspectId: 's-roni' } } };
f = gameReducer(f, { type: 'START_INTERROGATION' });
for (let i = 0; i < 10 && f.interrogation!.status === 'active'; i++) f = gameReducer(f, { type: 'INTERROGATION_ACTION', tactic: 'pressure' });
console.log('pressure-only outcome:', f.interrogation!.status);
void getCase;
