import casesData from '../data/cases/cases.json';
import { generateCase } from './caseGenerator';
import type {
  BoardLink,
  CaseFile,
  CaseProgress,
  CasesFile,
  Clue,
  DetectiveProfile,
  EvidenceNode,
  LinkVerdict,
  MapHotspot,
  Specialization,
} from '../types/investigation';

/** Number of validated links to a single suspect required for a warrant. */
export const WARRANT_THRESHOLD = 3;

export const RANKS = ['מפקח משנה', 'מפקח', 'פקד', 'רפ״ד', 'סנ״צ', 'נצ״מ', 'תנ״צ'] as const;
export const RANK_TITLES = [
  'חוקר זוטר',
  'חוקר תיקים',
  'ראש צוות חקירות',
  'ראש מחלק פשעים',
  'ראש לשכת חקירות',
  'מפקד מרחב',
  'ראש אגף חקירות',
] as const;
/** Solved cases needed for each rank. Past the story cases promotions slow down. */
export const RANK_THRESHOLDS = [0, 1, 2, 3, 6, 10, 15] as const;

export const SPECIALIZATIONS: Record<Specialization, { label: string; perk: string }> = {
  criminal: {
    label: 'חקירות פליליות',
    perk: 'פותחים חקירה באזהרה עם שיתוף פעולה גבוה יותר, ולחץ פסיכולוגי פחות מסוכן.',
  },
  intel: {
    label: 'מודיעין',
    perk: 'תשאול עדים ובדיקת מצלמות מניבים ניקוד מודיעיני כפול, ורמזי המפקד זולים יותר.',
  },
  forensic: {
    label: 'זיהוי פלילי',
    perk: 'ניתוחי מעבדת מז״פ מניבים ניקוד מודיעיני גבוה ומחזקים את האמינות שלכם.',
  },
};

export const CATEGORY_LABELS: Record<Clue['category'], string> = {
  clue: 'ממצא בזירה',
  motive: 'מניע',
  alibi: 'אליבי',
};

export const SOURCE_LABELS: Record<Clue['source'], string> = {
  physical: 'ראיה פיזית',
  testimony: 'עדות',
  cctv: 'מצלמות אבטחה',
  forensic: 'ראיה פורנזית',
  document: 'מסמך',
};

const data = casesData as CasesFile;

/*
 * Endless cases: after the story cases the desk keeps filling up with
 * generated ones. Generated case n lands after n + 2 solved cases, so there
 * are always a few open files. The horizon is how many generated cases the
 * detective has reached so far; loadCases() lists exactly those.
 */
let generatedHorizon = 0;

export function generatedCountFor(solvedCount: number): number {
  return Math.max(0, solvedCount - 2);
}

/** Keep the case list in step with the detective's progress. */
export function syncCaseHorizon(solvedCount: number) {
  generatedHorizon = generatedCountFor(solvedCount);
}

export function storyCases(): CaseFile[] {
  return [...data.cases].sort((a, b) => a.order - b.order);
}

export function loadCases(): CaseFile[] {
  const generated: CaseFile[] = [];
  for (let n = 1; n <= generatedHorizon; n++) generated.push(generateCase(n));
  return [...storyCases(), ...generated];
}

export function getCase(caseId: string): CaseFile {
  const gen = /^gen-(\d+)$/.exec(caseId);
  if (gen) return generateCase(Number(gen[1]));
  const found = data.cases.find((c) => c.id === caseId);
  if (!found) throw new Error(`Unknown case: ${caseId}`);
  return found;
}

export function getClue(caseFile: CaseFile, clueId: string): Clue | undefined {
  return caseFile.clues.find((c) => c.id === clueId);
}

export function getSuspect(caseFile: CaseFile, suspectId: string) {
  return caseFile.suspects.find((s) => s.id === suspectId);
}

export function emptyProgress(): CaseProgress {
  return {
    collected: [],
    analyzed: [],
    visitedHotspots: [],
    links: [],
    warrantSuspectId: null,
    interrogationAttempts: 0,
    hintsUsed: 0,
    solved: false,
    score: 0,
  };
}

/** Has this case already landed on the detective's desk? */
export function isCaseUnlocked(caseFile: CaseFile, solvedCount: number): boolean {
  return solvedCount >= (caseFile.unlockAfter ?? 0);
}

export function rankForSolvedCount(solvedCount: number): number {
  let rank = 0;
  RANK_THRESHOLDS.forEach((need, i) => {
    if (solvedCount >= need) rank = i;
  });
  return rank;
}

export function rankLabel(profile: DetectiveProfile): string {
  return RANKS[profile.rankIndex];
}

/* ------------------------------------------------------------------ */
/* Evidence collection                                                 */
/* ------------------------------------------------------------------ */

export function isHotspotAvailable(hotspot: MapHotspot, progress: CaseProgress): boolean {
  return (hotspot.requires ?? []).every((id) => progress.collected.includes(id));
}

export function isHotspotExhausted(hotspot: MapHotspot, progress: CaseProgress): boolean {
  return progress.visitedHotspots.includes(hotspot.id);
}

export function isPendingLab(clue: Clue, progress: CaseProgress): boolean {
  return Boolean(clue.requiresLab) && !progress.analyzed.includes(clue.id);
}

export function pendingLabClues(caseFile: CaseFile, progress: CaseProgress): Clue[] {
  return progress.collected
    .map((id) => getClue(caseFile, id))
    .filter((c): c is Clue => Boolean(c) && isPendingLab(c as Clue, progress));
}

/** Description shown for a clue, taking lab analysis into account. */
export function clueDisplayText(clue: Clue, progress: CaseProgress): string {
  if (clue.requiresLab && progress.analyzed.includes(clue.id) && clue.labResult) {
    return clue.labResult;
  }
  return clue.description;
}

export function collectedClues(caseFile: CaseFile, progress: CaseProgress): Clue[] {
  return progress.collected.map((id) => getClue(caseFile, id)).filter((c): c is Clue => Boolean(c));
}

/** Intel points earned for collecting a piece of evidence. */
export function intelForCollection(clue: Clue, specialization: Specialization): number {
  const base = 10;
  if (specialization === 'intel' && (clue.source === 'cctv' || clue.source === 'testimony')) return base * 2;
  return base;
}

export function intelForLab(specialization: Specialization): number {
  return specialization === 'forensic' ? 30 : 15;
}

export function hintCost(specialization: Specialization): number {
  return specialization === 'intel' ? 10 : 20;
}

/* ------------------------------------------------------------------ */
/* Evidence board & deduction                                          */
/* ------------------------------------------------------------------ */

/** Verify whether a piece of evidence logically connects to a suspect. */
export function validateLink(caseFile: CaseFile, suspectId: string, evidenceId: string): LinkVerdict {
  const clue = getClue(caseFile, evidenceId);
  if (!clue) return 'invalid';
  if (clue.implicates.includes(suspectId)) return 'implicates';
  if (clue.clears.includes(suspectId)) return 'clears';
  return 'invalid';
}

export function isSuspectCleared(progress: CaseProgress, suspectId: string): boolean {
  return progress.links.some((l) => l.suspectId === suspectId && l.verdict === 'clears');
}

export function implicatingLinks(progress: CaseProgress, suspectId: string): BoardLink[] {
  return progress.links.filter((l) => l.suspectId === suspectId && l.verdict === 'implicates');
}

export interface DeductionResult {
  suspectId: string;
  validatedCount: number;
  cleared: boolean;
  canIssueWarrant: boolean;
  categories: Clue['category'][];
}

/** Evaluate the deduction state for every suspect on the board. */
export function evaluateDeduction(caseFile: CaseFile, progress: CaseProgress): DeductionResult[] {
  return caseFile.suspects.map((s) => {
    const links = implicatingLinks(progress, s.id);
    const cleared = isSuspectCleared(progress, s.id);
    const categories = Array.from(
      new Set(links.map((l) => getClue(caseFile, l.evidenceId)?.category).filter(Boolean)),
    ) as Clue['category'][];
    return {
      suspectId: s.id,
      validatedCount: links.length,
      cleared,
      canIssueWarrant: !cleared && links.length >= WARRANT_THRESHOLD,
      categories,
    };
  });
}

export function buildEvidenceNodes(caseFile: CaseFile, progress: CaseProgress): EvidenceNode[] {
  const suspects: EvidenceNode[] = caseFile.suspects.map((s) => ({
    kind: 'suspect',
    id: s.id,
    suspect: s,
    cleared: isSuspectCleared(progress, s.id),
  }));
  const evidence: EvidenceNode[] = collectedClues(caseFile, progress).map((clue) => ({
    kind: clue.category,
    id: clue.id,
    clue,
    pendingLab: isPendingLab(clue, progress),
  }));
  return [...suspects, ...evidence];
}

export function caseScore(progress: CaseProgress, mistakes: number): number {
  const base = 200;
  const evidenceBonus = progress.collected.length * 5;
  const penalty = mistakes * 15 + progress.interrogationAttempts * 20 + progress.hintsUsed * 10;
  return Math.max(50, base + evidenceBonus - penalty);
}
