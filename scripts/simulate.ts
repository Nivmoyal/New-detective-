// Headless playthrough of every case through the real game reducer.
import { gameReducer, initialState, type GameState, type GameAction } from '../src/state/gameReducer';
import { getCase, evaluateDeduction, validateLink } from '../src/services/caseEngine';
import { defaultPlayerLook } from '../src/data/characters';

let s: GameState = initialState();
const d = (a: GameAction) => (s = gameReducer(s, a));
d({ type: 'CREATE_PROFILE', name: 'בודק', specialization: 'intel', addressForm: 'female', look: defaultPlayerLook('female') });
d({ type: 'ARRIVAL_COMMANDER_DONE' });
for (let n = 0; n < 3; n++) {
  d({ type: 'TAKE_CASE' });
  const c = getCase(s.activeCaseId!);
  // Visit hotspots respecting requirement chains.
  for (let pass = 0; pass < 5; pass++)
    for (const h of c.hotspots) {
      const p = s.progress[c.id];
      if ((h.requires ?? []).every((r) => p.collected.includes(r))) d({ type: 'VISIT_HOTSPOT', hotspotId: h.id });
    }
  d({ type: 'ANALYZE_LAB' });
  const p = s.progress[c.id];
  if (p.collected.length !== c.clues.length) throw new Error(`${c.id}: collected ${p.collected.length}/${c.clues.length}`);
  for (const sus of c.suspects)
    for (const e of p.collected) {
      const v = validateLink(c, sus.id, e);
      if (v !== 'invalid') d({ type: 'LINK_RESULT', suspectId: sus.id, evidenceId: e, verdict: v });
    }
  const ded = evaluateDeduction(c, s.progress[c.id]);
  const target = ded.find((x) => x.canIssueWarrant);
  if (!target || target.suspectId !== c.culpritId || ded.filter((x) => x.canIssueWarrant).length !== 1)
    throw new Error(`${c.id}: bad deduction ${JSON.stringify(ded)}`);
  d({ type: 'ISSUE_WARRANT', suspectId: target.suspectId });
  d({ type: 'START_INTERROGATION' });
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
  if (it.status !== 'confessed') throw new Error(it.log.map((l) => l.text).join('\n'));
  d({ type: 'END_INTERROGATION' });
  d({ type: 'DISMISS_PROMOTION' });
}
console.log('rank', s.profile!.rankIndex, 'solved', s.profile!.solvedCases.length, 'intel', s.profile!.intelPoints, 'rel', s.profile!.reliability);
// Failure path: pure pressure should drive a suspect to demand a lawyer.
let f = initialState();
f = gameReducer(f, { type: 'CREATE_PROFILE', name: 'x', specialization: 'intel', addressForm: 'male', look: defaultPlayerLook('male') });
f = gameReducer(f, { type: 'TAKE_CASE' });
f = { ...f, progress: { ...f.progress, [f.activeCaseId!]: { ...f.progress[f.activeCaseId!], warrantSuspectId: 's-roni' } } };
f = gameReducer(f, { type: 'START_INTERROGATION' });
for (let i = 0; i < 10 && f.interrogation!.status === 'active'; i++) f = gameReducer(f, { type: 'INTERROGATION_ACTION', tactic: 'pressure' });
console.log('pressure-only outcome:', f.interrogation!.status);
