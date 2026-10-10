import type {
  AddressForm,
  ArrivalStep,
  CaseProgress,
  CharacterLook,
  DetectiveProfile,
  InterrogationState,
  LinkVerdict,
  Specialization,
  TacticId,
  View,
} from '../types/investigation';
import { MAPS, STATION_MAP_ID } from '../data/maps';
import { defaultPlayerLook } from '../data/characters';
import {
  caseScore,
  emptyProgress,
  evaluateDeduction,
  getCase,
  getSuspect,
  hintCost,
  intelForCollection,
  intelForLab,
  isHotspotAvailable,
  loadCases,
  pendingLabClues,
  rankForSolvedCount,
} from '../services/caseEngine';
import { applyTactic, startInterrogation } from '../services/interrogationEngine';

/*
  arrivalStep keeps track of the first day, but never blocks anything:
  'toCommander' - has not reported to the commander yet
  'toDesk'      - has not opened the case files on the desk yet
  'done'        - knows every open case
*/
export interface GameState {
  version: 2;
  profile: DetectiveProfile | null;
  arrivalStep: ArrivalStep;
  /** Case shown on the board / hub. Any case can be focused at any time. */
  activeCaseId: string | null;
  progress: Record<string, CaseProgress>;
  currentMapId: string;
  positions: Record<string, { x: number; y: number }>;
  view: View;
  interrogation: InterrogationState | null;
  /** Case of the running interrogation. */
  interrogationCaseId: string | null;
  promotionCaseId: string | null;
}

export type GameAction =
  | { type: 'CREATE_PROFILE'; name: string; specialization: Specialization; addressForm: AddressForm; look: CharacterLook }
  | { type: 'ARRIVAL_COMMANDER_DONE' }
  | { type: 'OPEN_CASE_FILES' }
  | { type: 'FOCUS_CASE'; caseId: string }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'TRAVEL'; mapId: string }
  | { type: 'SAVE_POSITION'; mapId: string; x: number; y: number }
  | { type: 'VISIT_HOTSPOT'; caseId: string; hotspotId: string }
  | { type: 'ANALYZE_LAB' }
  | { type: 'LINK_RESULT'; suspectId: string; evidenceId: string; verdict: LinkVerdict }
  | { type: 'REMOVE_LINK'; suspectId: string; evidenceId: string }
  | { type: 'REQUEST_WARRANT'; suspectId: string }
  | { type: 'USE_HINT' }
  | { type: 'START_INTERROGATION'; caseId?: string }
  | { type: 'INTERROGATION_ACTION'; tactic: TacticId; evidenceId?: string }
  | { type: 'END_INTERROGATION' }
  | { type: 'DISMISS_PROMOTION' }
  | { type: 'RESET' };

export const STORAGE_KEY = 'precinct-tlv-state-v2';
const LEGACY_KEY = 'precinct-tlv-state-v1';

/** Reliability lost when asking the commander for a warrant without enough evidence. */
export const WARRANT_DENIAL_PENALTY = 8;

export function initialState(): GameState {
  return {
    version: 2,
    profile: null,
    arrivalStep: 'profile',
    activeCaseId: null,
    progress: {},
    currentMapId: STATION_MAP_ID,
    positions: {},
    view: 'map',
    interrogation: null,
    interrogationCaseId: null,
    promotionCaseId: null,
  };
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed.version !== 2) return initialState();
      const state = { ...initialState(), ...parsed };
      if (!MAPS[state.currentMapId]) state.currentMapId = STATION_MAP_ID;
      return state;
    }
    // Older saves: keep the detective and the case work, restart on the new maps.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<GameState> & { profile?: DetectiveProfile | null };
      const state = initialState();
      if (old.profile) {
        state.profile = { ...old.profile, look: old.profile.look ?? defaultPlayerLook(old.profile.addressForm) };
        state.arrivalStep = old.arrivalStep ?? 'done';
        state.progress = old.progress ?? {};
        state.activeCaseId = old.activeCaseId ?? null;
      }
      return state;
    }
  } catch {
    // Corrupt storage - start fresh.
  }
  return initialState();
}

export function saveState(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode) - the game still works in memory.
  }
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function withProfile(state: GameState, fn: (p: DetectiveProfile) => Partial<DetectiveProfile>): GameState {
  if (!state.profile) return state;
  return { ...state, profile: { ...state.profile, ...fn(state.profile) } };
}

function caseProgress(state: GameState, caseId: string): CaseProgress {
  return state.progress[caseId] ?? emptyProgress();
}

function updateCase(state: GameState, caseId: string, fn: (p: CaseProgress) => Partial<CaseProgress>): GameState {
  const current = caseProgress(state, caseId);
  return { ...state, progress: { ...state.progress, [caseId]: { ...current, ...fn(current) } } };
}

function updateActive(state: GameState, fn: (p: CaseProgress) => Partial<CaseProgress>): GameState {
  if (!state.activeCaseId) return state;
  return updateCase(state, state.activeCaseId, fn);
}

export function activeProgress(state: GameState): CaseProgress | null {
  if (!state.activeCaseId) return null;
  return caseProgress(state, state.activeCaseId);
}

/** Cases the detective knows about (read on the desk or touched in the field). */
export function knownCaseIds(state: GameState): string[] {
  return loadCases()
    .filter((c) => state.arrivalStep === 'done' || state.progress[c.id])
    .map((c) => c.id);
}

/** Can the commander sign a warrant for this suspect right now? */
export function warrantJustified(state: GameState, suspectId: string): boolean {
  if (!state.activeCaseId) return false;
  const ded = evaluateDeduction(getCase(state.activeCaseId), caseProgress(state, state.activeCaseId));
  return !!ded.find((d) => d.suspectId === suspectId)?.canIssueWarrant;
}

function firstOpenCase(state: GameState, exclude?: string): string | null {
  const solved = state.profile?.solvedCases ?? [];
  const open = loadCases().filter((c) => c.id !== exclude && !solved.includes(c.id));
  const touched = open.find((c) => (state.progress[c.id]?.collected.length ?? 0) > 0);
  return (touched ?? open[0])?.id ?? null;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'CREATE_PROFILE':
      return {
        ...state,
        profile: {
          name: action.name.trim(),
          specialization: action.specialization,
          addressForm: action.addressForm,
          look: action.look,
          rankIndex: 0,
          solvedCases: [],
          reliability: 60,
          intelPoints: 0,
        },
        arrivalStep: 'toCommander',
        currentMapId: STATION_MAP_ID,
        view: 'map',
      };

    case 'ARRIVAL_COMMANDER_DONE':
      return state.arrivalStep === 'toCommander' ? { ...state, arrivalStep: 'toDesk' } : state;

    case 'OPEN_CASE_FILES': {
      const progress = { ...state.progress };
      for (const c of loadCases()) progress[c.id] = progress[c.id] ?? emptyProgress();
      const next = { ...state, arrivalStep: 'done' as const, progress };
      return { ...next, activeCaseId: state.activeCaseId ?? firstOpenCase(next) };
    }

    case 'FOCUS_CASE':
      return { ...state, activeCaseId: action.caseId, progress: { ...state.progress, [action.caseId]: caseProgress(state, action.caseId) } };

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'TRAVEL':
      if (!MAPS[action.mapId]) return state;
      return { ...state, currentMapId: action.mapId, view: 'map' };

    case 'SAVE_POSITION':
      return { ...state, positions: { ...state.positions, [action.mapId]: { x: action.x, y: action.y } } };

    case 'VISIT_HOTSPOT': {
      if (!state.profile) return state;
      const caseFile = getCase(action.caseId);
      const hotspot = caseFile.hotspots.find((h) => h.id === action.hotspotId);
      const progress = caseProgress(state, action.caseId);
      if (!hotspot || progress.visitedHotspots.includes(hotspot.id) || !isHotspotAvailable(hotspot, progress)) return state;
      const fresh = hotspot.evidenceIds.filter((id) => !progress.collected.includes(id));
      const spec = state.profile.specialization;
      const intel = fresh.reduce((sum, id) => {
        const clue = caseFile.clues.find((c) => c.id === id);
        return sum + (clue ? intelForCollection(clue, spec) : 0);
      }, 0);
      const next = updateCase(state, action.caseId, (p) => ({
        visitedHotspots: [...p.visitedHotspots, hotspot.id],
        collected: [...p.collected, ...fresh],
      }));
      return {
        ...withProfile(next, (p) => ({ intelPoints: p.intelPoints + intel })),
        activeCaseId: state.activeCaseId ?? action.caseId,
      };
    }

    case 'ANALYZE_LAB': {
      if (!state.profile) return state;
      const spec = state.profile.specialization;
      let next = state;
      let count = 0;
      for (const c of loadCases()) {
        const pending = pendingLabClues(c, caseProgress(state, c.id));
        if (!pending.length) continue;
        count += pending.length;
        next = updateCase(next, c.id, (p) => ({ analyzed: [...p.analyzed, ...pending.map((x) => x.id)] }));
      }
      if (!count) return state;
      return withProfile(next, (p) => ({
        intelPoints: p.intelPoints + intelForLab(spec) * count,
        reliability: clamp(p.reliability + (spec === 'forensic' ? 3 : 1) * count),
      }));
    }

    case 'LINK_RESULT': {
      if (action.verdict === 'invalid') {
        return withProfile(state, (p) => ({ reliability: clamp(p.reliability - 5) }));
      }
      const verdict = action.verdict;
      const progress = activeProgress(state);
      if (!progress) return state;
      if (progress.links.some((l) => l.suspectId === action.suspectId && l.evidenceId === action.evidenceId)) {
        return state;
      }
      const next = updateActive(state, (p) => ({
        links: [...p.links, { suspectId: action.suspectId, evidenceId: action.evidenceId, verdict }],
      }));
      return withProfile(next, (p) => ({ intelPoints: p.intelPoints + 5, reliability: clamp(p.reliability + 2) }));
    }

    case 'REMOVE_LINK':
      return updateActive(state, (p) => ({
        links: p.links.filter((l) => !(l.suspectId === action.suspectId && l.evidenceId === action.evidenceId)),
      }));

    case 'REQUEST_WARRANT': {
      const progress = activeProgress(state);
      if (!progress || progress.warrantSuspectId || progress.solved) return state;
      if (!warrantJustified(state, action.suspectId)) {
        // The commander refuses - and remembers.
        return withProfile(state, (p) => ({ reliability: clamp(p.reliability - WARRANT_DENIAL_PENALTY) }));
      }
      return updateActive(state, () => ({ warrantSuspectId: action.suspectId }));
    }

    case 'USE_HINT': {
      if (!state.profile || !state.activeCaseId) return state;
      const cost = hintCost(state.profile.specialization);
      const caseFile = getCase(state.activeCaseId);
      const progress = activeProgress(state)!;
      if (state.profile.intelPoints < cost || progress.hintsUsed >= caseFile.hints.length) return state;
      const next = updateActive(state, (p) => ({ hintsUsed: p.hintsUsed + 1 }));
      return withProfile(next, (p) => ({ intelPoints: p.intelPoints - cost }));
    }

    case 'START_INTERROGATION': {
      const caseId = action.caseId ?? state.activeCaseId;
      if (!state.profile || !caseId) return state;
      const progress = caseProgress(state, caseId);
      if (!progress.warrantSuspectId || progress.solved) return state;
      const suspect = getSuspect(getCase(caseId), progress.warrantSuspectId);
      if (!suspect?.interrogation) return state;
      return {
        ...state,
        activeCaseId: caseId,
        interrogation: startInterrogation(suspect, state.profile.specialization),
        interrogationCaseId: caseId,
        view: 'interrogation',
      };
    }

    case 'INTERROGATION_ACTION': {
      const caseId = state.interrogationCaseId ?? state.activeCaseId;
      if (!state.interrogation || !caseId || !state.profile) return state;
      const caseFile = getCase(caseId);
      const suspect = getSuspect(caseFile, state.interrogation.suspectId);
      if (!suspect) return state;
      return {
        ...state,
        interrogation: applyTactic(state.interrogation, caseFile, suspect, action.tactic, state.profile.specialization, action.evidenceId),
      };
    }

    case 'END_INTERROGATION': {
      const session = state.interrogation;
      const caseId = state.interrogationCaseId ?? state.activeCaseId;
      const closed = { interrogation: null, interrogationCaseId: null };
      if (!session || !caseId || !state.profile) return { ...state, ...closed };
      if (session.status === 'active') {
        // Walking out mid-session is allowed, but the suspect gets time to regroup.
        const next = updateCase(state, caseId, (p) => ({ interrogationAttempts: p.interrogationAttempts + 1 }));
        return { ...next, ...closed, view: 'hub' };
      }
      if (session.status !== 'confessed') {
        const next = updateCase(state, caseId, (p) => ({ interrogationAttempts: p.interrogationAttempts + 1 }));
        return { ...withProfile(next, (p) => ({ reliability: clamp(p.reliability - 10) })), ...closed, view: 'hub' };
      }
      const progress = caseProgress(state, caseId);
      const score = caseScore(progress, session.mistakes);
      const solvedState = updateCase(state, caseId, () => ({ solved: true, score }));
      const solvedCases = [...state.profile.solvedCases.filter((id) => id !== caseId), caseId];
      const next = withProfile(solvedState, (p) => ({
        solvedCases,
        rankIndex: rankForSolvedCount(solvedCases.length),
        intelPoints: p.intelPoints + score,
        reliability: clamp(p.reliability + 15),
      }));
      return {
        ...next,
        ...closed,
        activeCaseId: firstOpenCase(next, caseId),
        promotionCaseId: caseId,
        view: 'hub',
      };
    }

    case 'DISMISS_PROMOTION':
      return { ...state, promotionCaseId: null };

    case 'RESET':
      return initialState();

    default:
      return state;
  }
}

export function allCasesSolved(state: GameState): boolean {
  return !!state.profile && loadCases().every((c) => state.profile!.solvedCases.includes(c.id));
}

export type { ArrivalStep };
