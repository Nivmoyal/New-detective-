import type {
  AddressForm,
  ArrivalStep,
  CaseProgress,
  DetectiveProfile,
  InterrogationState,
  LinkVerdict,
  Specialization,
  TacticId,
  View,
} from '../types/investigation';
import { MAPS, STATION_MAP_ID } from '../data/maps';
import {
  caseScore,
  emptyProgress,
  getCase,
  getSuspect,
  hintCost,
  intelForCollection,
  intelForLab,
  loadCases,
  nextCaseId,
  pendingLabClues,
  rankForSolvedCount,
} from '../services/caseEngine';
import { applyTactic, startInterrogation } from '../services/interrogationEngine';

export interface GameState {
  version: 1;
  profile: DetectiveProfile | null;
  arrivalStep: ArrivalStep;
  activeCaseId: string | null;
  progress: Record<string, CaseProgress>;
  currentMapId: string;
  positions: Record<string, { x: number; y: number }>;
  view: View;
  interrogation: InterrogationState | null;
  promotionCaseId: string | null;
}

export type GameAction =
  | { type: 'CREATE_PROFILE'; name: string; specialization: Specialization; addressForm: AddressForm }
  | { type: 'ARRIVAL_COMMANDER_DONE' }
  | { type: 'TAKE_CASE' }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'TRAVEL'; mapId: string }
  | { type: 'SAVE_POSITION'; mapId: string; x: number; y: number }
  | { type: 'VISIT_HOTSPOT'; hotspotId: string }
  | { type: 'ANALYZE_LAB' }
  | { type: 'LINK_RESULT'; suspectId: string; evidenceId: string; verdict: LinkVerdict }
  | { type: 'REMOVE_LINK'; suspectId: string; evidenceId: string }
  | { type: 'ISSUE_WARRANT'; suspectId: string }
  | { type: 'USE_HINT' }
  | { type: 'START_INTERROGATION' }
  | { type: 'INTERROGATION_ACTION'; tactic: TacticId; evidenceId?: string }
  | { type: 'END_INTERROGATION' }
  | { type: 'DISMISS_PROMOTION' }
  | { type: 'RESET' };

export const STORAGE_KEY = 'precinct-tlv-state-v1';

export function initialState(): GameState {
  return {
    version: 1,
    profile: null,
    arrivalStep: 'profile',
    activeCaseId: null,
    progress: {},
    currentMapId: STATION_MAP_ID,
    positions: {},
    view: 'map',
    interrogation: null,
    promotionCaseId: null,
  };
}

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== 1 || !MAPS[parsed.currentMapId]) return initialState();
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
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

function updateProgress(state: GameState, fn: (p: CaseProgress) => Partial<CaseProgress>): GameState {
  if (!state.activeCaseId) return state;
  const current = state.progress[state.activeCaseId] ?? emptyProgress();
  return {
    ...state,
    progress: { ...state.progress, [state.activeCaseId]: { ...current, ...fn(current) } },
  };
}

export function activeProgress(state: GameState): CaseProgress | null {
  if (!state.activeCaseId) return null;
  return state.progress[state.activeCaseId] ?? emptyProgress();
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
      return { ...state, arrivalStep: 'toDesk' };

    case 'TAKE_CASE': {
      const id = nextCaseId(state.profile?.solvedCases ?? []);
      if (!id) return state;
      return {
        ...state,
        arrivalStep: 'done',
        activeCaseId: id,
        progress: { ...state.progress, [id]: state.progress[id] ?? emptyProgress() },
      };
    }

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'TRAVEL':
      if (!MAPS[action.mapId]) return state;
      return { ...state, currentMapId: action.mapId, view: 'map' };

    case 'SAVE_POSITION':
      return { ...state, positions: { ...state.positions, [action.mapId]: { x: action.x, y: action.y } } };

    case 'VISIT_HOTSPOT': {
      if (!state.activeCaseId || !state.profile) return state;
      const caseFile = getCase(state.activeCaseId);
      const hotspot = caseFile.hotspots.find((h) => h.id === action.hotspotId);
      const progress = activeProgress(state)!;
      if (!hotspot || progress.visitedHotspots.includes(hotspot.id)) return state;
      const fresh = hotspot.evidenceIds.filter((id) => !progress.collected.includes(id));
      const spec = state.profile.specialization;
      const intel = fresh.reduce((sum, id) => {
        const clue = caseFile.clues.find((c) => c.id === id);
        return sum + (clue ? intelForCollection(clue, spec) : 0);
      }, 0);
      const next = updateProgress(state, (p) => ({
        visitedHotspots: [...p.visitedHotspots, hotspot.id],
        collected: [...p.collected, ...fresh],
      }));
      return withProfile(next, (p) => ({ intelPoints: p.intelPoints + intel }));
    }

    case 'ANALYZE_LAB': {
      if (!state.activeCaseId || !state.profile) return state;
      const caseFile = getCase(state.activeCaseId);
      const pending = pendingLabClues(caseFile, activeProgress(state)!);
      if (pending.length === 0) return state;
      const spec = state.profile.specialization;
      const next = updateProgress(state, (p) => ({ analyzed: [...p.analyzed, ...pending.map((c) => c.id)] }));
      return withProfile(next, (p) => ({
        intelPoints: p.intelPoints + intelForLab(spec) * pending.length,
        reliability: clamp(p.reliability + (spec === 'forensic' ? 3 : 1) * pending.length),
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
      const next = updateProgress(state, (p) => ({
        links: [...p.links, { suspectId: action.suspectId, evidenceId: action.evidenceId, verdict }],
      }));
      return withProfile(next, (p) => ({ intelPoints: p.intelPoints + 5, reliability: clamp(p.reliability + 2) }));
    }

    case 'REMOVE_LINK':
      return updateProgress(state, (p) => ({
        links: p.links.filter((l) => !(l.suspectId === action.suspectId && l.evidenceId === action.evidenceId)),
      }));

    case 'ISSUE_WARRANT':
      return updateProgress(state, () => ({ warrantSuspectId: action.suspectId }));

    case 'USE_HINT': {
      if (!state.profile || !state.activeCaseId) return state;
      const cost = hintCost(state.profile.specialization);
      const caseFile = getCase(state.activeCaseId);
      const progress = activeProgress(state)!;
      if (state.profile.intelPoints < cost || progress.hintsUsed >= caseFile.hints.length) return state;
      const next = updateProgress(state, (p) => ({ hintsUsed: p.hintsUsed + 1 }));
      return withProfile(next, (p) => ({ intelPoints: p.intelPoints - cost }));
    }

    case 'START_INTERROGATION': {
      const progress = activeProgress(state);
      if (!state.profile || !state.activeCaseId || !progress?.warrantSuspectId) return state;
      const suspect = getSuspect(getCase(state.activeCaseId), progress.warrantSuspectId);
      if (!suspect?.interrogation) return state;
      return {
        ...state,
        interrogation: startInterrogation(suspect, state.profile.specialization),
        view: 'interrogation',
      };
    }

    case 'INTERROGATION_ACTION': {
      if (!state.interrogation || !state.activeCaseId || !state.profile) return state;
      const caseFile = getCase(state.activeCaseId);
      const suspect = getSuspect(caseFile, state.interrogation.suspectId);
      if (!suspect) return state;
      return {
        ...state,
        interrogation: applyTactic(
          state.interrogation,
          caseFile,
          suspect,
          action.tactic,
          state.profile.specialization,
          action.evidenceId,
        ),
      };
    }

    case 'END_INTERROGATION': {
      const session = state.interrogation;
      if (!session || !state.activeCaseId || !state.profile) return { ...state, interrogation: null };
      if (session.status === 'active') {
        // Walking out mid-session is allowed, but the suspect gets time to regroup.
        const next = updateProgress(state, (p) => ({ interrogationAttempts: p.interrogationAttempts + 1 }));
        return { ...next, interrogation: null, view: 'hub' };
      }
      if (session.status !== 'confessed') {
        const next = updateProgress(state, (p) => ({ interrogationAttempts: p.interrogationAttempts + 1 }));
        return {
          ...withProfile(next, (p) => ({ reliability: clamp(p.reliability - 10) })),
          interrogation: null,
          view: 'hub',
        };
      }
      const caseId = state.activeCaseId;
      const progress = activeProgress(state)!;
      const score = caseScore(progress, session.mistakes);
      const solvedState = updateProgress(state, () => ({ solved: true, score }));
      const solvedCases = [...state.profile.solvedCases.filter((id) => id !== caseId), caseId];
      return {
        ...withProfile(solvedState, (p) => ({
          solvedCases,
          rankIndex: rankForSolvedCount(solvedCases.length),
          intelPoints: p.intelPoints + score,
          reliability: clamp(p.reliability + 15),
        })),
        activeCaseId: null,
        interrogation: null,
        promotionCaseId: caseId,
        currentMapId: STATION_MAP_ID,
        view: 'map',
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
