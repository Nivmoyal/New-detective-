// Core domain types for the detective investigation game.

export type Specialization = 'criminal' | 'intel' | 'forensic';
export type AddressForm = 'male' | 'female';

export interface DetectiveProfile {
  name: string;
  specialization: Specialization;
  addressForm: AddressForm;
  rankIndex: number;
  solvedCases: string[];
  /** Reliability / credibility with the command staff (0-100). */
  reliability: number;
  /** Intelligence score accumulated through investigative work. */
  intelPoints: number;
}

export type EvidenceCategory = 'clue' | 'motive' | 'alibi';
export type EvidenceSource = 'physical' | 'testimony' | 'cctv' | 'forensic' | 'document';

export interface Clue {
  id: string;
  title: string;
  /** What the detective sees when the item is first collected. */
  description: string;
  category: EvidenceCategory;
  source: EvidenceSource;
  /** Raw item that must be analyzed at the forensic lab before use. */
  requiresLab?: boolean;
  labResult?: string;
  /** Suspects this item points towards. */
  implicates: string[];
  /** Suspects this item eliminates from suspicion. */
  clears: string[];
}

export interface InterrogationLines {
  pressure: string[];
  trust: string[];
  evidenceHit: string[];
  evidenceKey: string[];
  evidenceMiss: string[];
  confrontFail: string[];
  confrontSuccess: string[];
  wavering: string[];
}

export interface InterrogationProfile {
  openingStatement: string;
  /** Tension added by psychological pressure. */
  pressureSensitivity: number;
  /** Cooperation gained by rapport building. */
  trustAffinity: number;
  startTension: number;
  startCooperation: number;
  /** Progress points needed to break the suspect. */
  breakThreshold: number;
  /** Evidence that hits the suspect hardest. */
  keyEvidence: string[];
  lines: InterrogationLines;
  confession: string[];
  lawyer: string;
  silence: string;
}

export interface Suspect {
  id: string;
  name: string;
  age: number;
  occupation: string;
  description: string;
  interrogation?: InterrogationProfile;
}

export type HotspotKind = 'collect' | 'witness' | 'cctv';

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface MapHotspot {
  id: string;
  mapId: string;
  x: number;
  y: number;
  kind: HotspotKind;
  label: string;
  title: string;
  dialogue: DialogueLine[];
  evidenceIds: string[];
  /** Evidence ids that must be collected before this hotspot appears. */
  requires?: string[];
}

export interface CaseFile {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  crimeType: string;
  locationName: string;
  summary: string;
  briefing: string[];
  closingStatement: string;
  mapIds: string[];
  culpritId: string;
  suspects: Suspect[];
  clues: Clue[];
  hotspots: MapHotspot[];
  /** Commander hints, revealed one at a time for intel points. */
  hints: string[];
}

export interface CasesFile {
  cases: CaseFile[];
}

export type LinkVerdict = 'implicates' | 'clears' | 'invalid';

export interface BoardLink {
  suspectId: string;
  evidenceId: string;
  verdict: Exclude<LinkVerdict, 'invalid'>;
}

/** A node pinned to the evidence board. */
export type EvidenceNode =
  | { kind: 'suspect'; id: string; suspect: Suspect; cleared: boolean }
  | { kind: EvidenceCategory; id: string; clue: Clue; pendingLab: boolean };

export interface CaseProgress {
  collected: string[];
  analyzed: string[];
  visitedHotspots: string[];
  links: BoardLink[];
  warrantSuspectId: string | null;
  interrogationAttempts: number;
  hintsUsed: number;
  solved: boolean;
  score: number;
}

export type TacticId = 'pressure' | 'evidence' | 'trust' | 'confront';

export interface InterrogationOption {
  id: TacticId;
  label: string;
  description: string;
}

export type InterrogationStatus = 'active' | 'confessed' | 'lawyer' | 'silent';

export interface InterrogationLogEntry {
  speaker: 'detective' | 'suspect' | 'system';
  text: string;
}

export interface InterrogationState {
  suspectId: string;
  tension: number;
  cooperation: number;
  progress: number;
  presented: string[];
  mistakes: number;
  turn: number;
  trustStreak: number;
  bonuses: string[];
  status: InterrogationStatus;
  log: InterrogationLogEntry[];
}

/** Tiles of the top-down maps. */
export type FacilityAction = 'commander' | 'desk' | 'lab' | 'interrogation' | 'evidenceRoom' | 'exit';

export interface FacilityHotspot {
  id: string;
  x: number;
  y: number;
  action: FacilityAction;
  label: string;
}

export interface MapLabel {
  x: number;
  y: number;
  text: string;
}

export interface MapNpc {
  x: number;
  y: number;
  color: string;
  facing: number;
}

export interface GameMap {
  id: string;
  name: string;
  district: string;
  description: string;
  tiles: string[];
  spawn: { x: number; y: number };
  labels: MapLabel[];
  facilities: FacilityHotspot[];
  npcs: MapNpc[];
  ambient: 'station' | 'street' | 'club';
}

export type View = 'hub' | 'map' | 'board' | 'interrogation';

export type ArrivalStep = 'profile' | 'toCommander' | 'toDesk' | 'done';
