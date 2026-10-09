import type { ReactNode } from 'react';
import {
  Activity,
  Award,
  CheckSquare,
  Compass,
  FileText,
  Fingerprint,
  Folder,
  Key,
  Lock,
  MapPin,
  ShieldAlert,
  Siren,
  UserCheck,
  X,
} from 'lucide-react';
import type { CaseFile, CaseProgress, CharacterRef, DetectiveProfile } from '../types/investigation';
import { COMMANDER, EVIDENCE_CLERK, LAB_TECH, PATROL_DRIVER } from '../data/characters';
import CharacterBanner from './CharacterBanner';
import { MAPS, SCENE_MAP_IDS, STATION_MAP_ID } from '../data/maps';
import {
  CATEGORY_LABELS,
  RANKS,
  RANK_TITLES,
  SOURCE_LABELS,
  clueDisplayText,
  collectedClues,
  hintCost,
  pendingLabClues,
} from '../services/caseEngine';

export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  tone = 'police',
  character,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
  tone?: 'police' | 'gold' | 'red';
  /** When set, the header shows the live 3D portrait of the person you are talking to. */
  character?: CharacterRef;
}) {
  const toneCls =
    tone === 'gold' ? 'bg-evidence/15 text-evidence-light' : tone === 'red' ? 'bg-alert/15 text-red-300' : 'bg-police/15 text-police-light';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="panel flex max-h-[88vh] w-full max-w-lg animate-fadeUp flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {character && (
          <div className="relative shrink-0">
            <CharacterBanner character={character} tone={tone} />
            <button onClick={onClose} aria-label="סגירה" className="absolute left-3 top-3 rounded-full bg-black/50 p-1.5 text-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={`flex items-center gap-2 border-b border-noir-border p-3 ${character ? 'hidden' : ''}`}>
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls}`}>{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-bold">{title}</div>
            {subtitle && <div className="truncate text-[11px] text-steel">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="סגירה" className="text-steel hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function LabModal({
  caseFile,
  progress,
  onAnalyze,
  onClose,
}: {
  caseFile: CaseFile | null;
  progress: CaseProgress | null;
  onAnalyze: () => void;
  onClose: () => void;
}) {
  const pending = caseFile && progress ? pendingLabClues(caseFile, progress) : [];
  const analyzed = caseFile && progress ? collectedClues(caseFile, progress).filter((c) => progress.analyzed.includes(c.id)) : [];
  return (
    <Modal title='מעבדת מז״פ' subtitle="מחלק זיהוי פלילי, מרחב יפתח" icon={<Fingerprint className="h-5 w-5" />} onClose={onClose} character={LAB_TECH}>
      <div className="mb-3 rounded-lg border border-noir-border bg-noir-deep/70 p-3 text-sm text-slate-300">
        <span className="font-bold text-sky-300">ד״ר מאיה שטרן: </span>
        {pending.length > 0
          ? `יש לך ${pending.length} פריטים בתור. תנו לי כמה דקות עם המיקרוסקופ.`
          : 'אין כרגע פריטים בתור. תביאו לי משהו מהזירה ואני אגיד לכם מי נגע בו.'}
      </div>
      {pending.map((c) => (
        <div key={c.id} className="mb-2 rounded-lg border border-evidence/40 bg-evidence/10 p-2.5">
          <div className="text-[10px] font-bold text-evidence-light">ממתין לניתוח</div>
          <div className="text-sm font-bold">{c.title}</div>
        </div>
      ))}
      {pending.length > 0 && (
        <button className="btn-gold mt-1 w-full" onClick={onAnalyze}>
          <Activity className="h-4 w-4" />
          שליחה לניתוח מעבדה
        </button>
      )}
      {analyzed.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-bold text-steel">תוצאות מעבדה</div>
          {analyzed.map((c) => (
            <div key={c.id} className="rounded-lg border border-noir-border bg-noir-deep/70 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                <CheckSquare className="h-3.5 w-3.5" /> נותח
              </div>
              <div className="text-sm font-bold">{c.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{c.labResult}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function EvidenceRoomModal({
  caseFile,
  progress,
  onClose,
}: {
  caseFile: CaseFile | null;
  progress: CaseProgress | null;
  onClose: () => void;
}) {
  const clues = caseFile && progress ? collectedClues(caseFile, progress) : [];
  return (
    <Modal title="חדר ראיות" subtitle={caseFile ? caseFile.shortTitle : 'אין תיק פעיל'} icon={<Folder className="h-5 w-5" />} onClose={onClose} tone="gold" character={EVIDENCE_CLERK}>
      <p className="mb-3 text-sm text-slate-300">
        {clues.length === 0 ? 'עוד לא הבאתם לי כלום. כל מה שתאספו בשטח - מגיע אליי, מתויג ונעול.' : 'הכל מתויג ונעול. הנה מה שיש לכם בתיק עד עכשיו:'}
      </p>
      {clues.length === 0 ? (
        <div className="py-4 text-center text-xs text-steel">המדפים ריקים.</div>
      ) : (
        <div className="space-y-2">
          {clues.map((c) => (
            <div key={c.id} className="rounded-lg border border-noir-border bg-noir-deep/70 p-2.5">
              <div className="text-[10px] font-bold text-evidence-light">
                {CATEGORY_LABELS[c.category]} · {SOURCE_LABELS[c.source]}
              </div>
              <div className="text-sm font-bold">{c.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-steel">{clueDisplayText(c, progress!)}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function TravelModal({
  currentMapId,
  caseFile,
  onTravel,
  onClose,
}: {
  currentMapId: string;
  caseFile: CaseFile | null;
  onTravel: (mapId: string) => void;
  onClose: () => void;
}) {
  const ids = [STATION_MAP_ID, ...SCENE_MAP_IDS];
  return (
    <Modal title="ניידת סיור" subtitle="בחירת יעד במרחב יפתח" icon={<Compass className="h-5 w-5" />} onClose={onClose} character={PATROL_DRIVER}>
      <p className="mb-3 text-sm text-slate-300">הניידת מונעת. לאן נוסעים?</p>
      <div className="space-y-2">
        {ids.map((id) => {
          const m = MAPS[id];
          const relevant = caseFile?.mapIds.includes(id) && id !== STATION_MAP_ID;
          const here = id === currentMapId;
          return (
            <button
              key={id}
              disabled={here}
              onClick={() => onTravel(id)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-right transition disabled:opacity-50 ${
                relevant ? 'border-evidence/60 bg-evidence/10 hover:border-evidence-light' : 'border-noir-border bg-noir-deep hover:border-police-light'
              }`}
            >
              <MapPin className={`mt-0.5 h-5 w-5 shrink-0 ${relevant ? 'text-evidence-light' : 'text-police-light'}`} />
              <span className="flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold">{m.name}</span>
                  {relevant && <span className="label-tag bg-evidence/20 text-evidence-light">רלוונטי לתיק</span>}
                  {here && <span className="label-tag bg-noir-border text-steel">מיקום נוכחי</span>}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-steel">{m.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function CommanderModal({
  profile,
  caseFile,
  progress,
  onHint,
  onClose,
}: {
  profile: DetectiveProfile;
  caseFile: CaseFile | null;
  progress: CaseProgress | null;
  onHint: () => void;
  onClose: () => void;
}) {
  const cost = hintCost(profile.specialization);
  const used = progress?.hintsUsed ?? 0;
  const g = (m: string, f: string) => (profile.addressForm === 'female' ? f : m);
  return (
    <Modal title='סנ״צ אורנה ברק' subtitle="מפקדת תחנת שרפשטיין" icon={<UserCheck className="h-5 w-5" />} onClose={onClose} character={COMMANDER}>
      {!caseFile ? (
        <p className="text-sm leading-relaxed text-slate-300">
          {`אין לך תיק פעיל כרגע. התיק הבא כבר מחכה על השולחן שלך במשרד החוקרים. ${g('לך', 'לכי')} לקחת אותו.`}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-noir-border bg-noir-deep/70 p-3 text-sm leading-relaxed text-slate-300">
            {caseFile.briefing.map((b, i) => (
              <p key={i} className={i ? 'mt-2' : ''}>
                {b}
              </p>
            ))}
          </div>
          {caseFile.hints.slice(0, used).map((h, i) => (
            <div key={i} className="rounded-lg border border-police/40 bg-police/10 p-3 text-sm text-blue-100">
              <span className="font-bold">כיוון {i + 1}: </span>
              {h}
            </div>
          ))}
          {used < caseFile.hints.length ? (
            <button className="btn-ghost w-full" disabled={profile.intelPoints < cost} onClick={onHint}>
              <Key className="h-4 w-4 text-evidence-light" />
              בקשת כיוון חקירה מהמפקדת ({cost} נקודות מודיעין)
            </button>
          ) : (
            <div className="text-center text-xs text-steel">המפקדת נתנה את כל הכיוונים שיש לה. מכאן זה בידיים שלך.</div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function CaseClosedModal({
  profile,
  caseFile,
  progress,
  allSolved,
  onClose,
}: {
  profile: DetectiveProfile;
  caseFile: CaseFile;
  progress: CaseProgress;
  allSolved: boolean;
  onClose: () => void;
}) {
  const promoted = profile.rankIndex > 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur">
      <div className="panel w-full max-w-md animate-fadeUp overflow-hidden text-center shadow-2xl">
        <div className="border-b border-noir-border bg-gradient-to-b from-evidence/20 to-transparent p-5">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-evidence-light bg-evidence/15">
            <Award className="h-7 w-7 text-evidence-light" />
          </div>
          <div className="text-xs font-bold text-evidence-light">התיק נסגר</div>
          <h2 className="font-display text-xl font-black">{caseFile.shortTitle}</h2>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-sm leading-relaxed text-slate-300">{caseFile.closingStatement}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-noir-border bg-noir-deep p-2">
              <div className="text-[10px] text-steel">ניקוד תיק</div>
              <div className="text-lg font-black text-sky-300">{progress.score}</div>
            </div>
            <div className="rounded-lg border border-noir-border bg-noir-deep p-2">
              <div className="text-[10px] text-steel">ראיות שנאספו</div>
              <div className="text-lg font-black text-evidence-light">
                {progress.collected.length}/{caseFile.clues.length}
              </div>
            </div>
          </div>
          {promoted && (
            <div className="rounded-lg border border-police/50 bg-police/10 p-3">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-blue-100">
                <ShieldAlert className="h-4 w-4" />
                קידום בדרגה
              </div>
              <div className="mt-1 font-display text-lg font-black">
                {RANKS[profile.rankIndex]} {profile.name}
              </div>
              <div className="text-xs text-steel">{RANK_TITLES[profile.rankIndex]}</div>
            </div>
          )}
          {allSolved && (
            <div className="rounded-lg border border-evidence/50 bg-evidence/10 p-3 text-sm text-amber-100">
              <Siren className="mx-auto mb-1 h-5 w-5 text-evidence-light" />
              שלושה תיקים, שלוש הודאות. מהיום הראשון בתחנה ועד ראשות מחלק פשעים - הוכחת שבדרום תל אביב עובדים
              לפי ראיות.
            </div>
          )}
          <button className="btn-gold w-full py-3" onClick={onClose}>
            <FileText className="h-4 w-4" />
            {allSolved ? 'חזרה לתחנה' : 'חזרה לתחנה - התיק הבא מחכה על השולחן'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function NoticeModal({
  title,
  text,
  character,
  onClose,
}: {
  title: string;
  text: string;
  character?: CharacterRef;
  onClose: () => void;
}) {
  return (
    <Modal title={title} icon={<Lock className="h-5 w-5" />} onClose={onClose} tone="red" character={character}>
      <p className="text-sm leading-relaxed text-slate-300">{text}</p>
      <button className="btn-ghost mt-4 w-full" onClick={onClose}>
        הבנתי
      </button>
    </Modal>
  );
}
