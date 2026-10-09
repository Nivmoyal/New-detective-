import {
  CheckSquare,
  Compass,
  Crosshair,
  Fingerprint,
  Folder,
  Lock,
  MapPin,
  ShieldAlert,
  Siren,
  Unlock,
  UserCheck,
} from 'lucide-react';
import type { ArrivalStep, CaseFile, CaseProgress, DetectiveProfile } from '../types/investigation';
import { MAPS } from '../data/maps';
import {
  RANKS,
  getObjectives,
  isCaseUnlocked,
  isSuspectCleared,
  loadCases,
  nextCaseId,
  pendingLabClues,
} from '../services/caseEngine';

interface Props {
  profile: DetectiveProfile;
  arrivalStep: ArrivalStep;
  caseFile: CaseFile | null;
  progress: CaseProgress | null;
  allProgress: Record<string, CaseProgress>;
  onOpenMap: () => void;
  onOpenTravel: () => void;
  onOpenBoard: () => void;
  onOpenInterrogation: () => void;
}

export default function StationHub({
  profile,
  arrivalStep,
  caseFile,
  progress,
  allProgress,
  onOpenMap,
  onOpenTravel,
  onOpenBoard,
  onOpenInterrogation,
}: Props) {
  const cases = loadCases();
  const upcoming = nextCaseId(profile.solvedCases);
  const objectives = caseFile && progress ? getObjectives(caseFile, progress) : [];
  const pendingLab = caseFile && progress ? pendingLabClues(caseFile, progress).length : 0;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-2xl space-y-3 p-3 pb-6">
        {arrivalStep !== 'done' && (
          <div className="panel border-police/60 p-4">
            <div className="mb-1 flex items-center gap-2 text-police-light">
              <Siren className="h-5 w-5" />
              <span className="text-xs font-bold">יום ראשון בתחנה</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-300">
              {arrivalStep === 'toCommander'
                ? 'המשימה הראשונה: להתייצב במשרד המפקדת בקומה, בפינה השמאלית העליונה של התחנה. עקבו אחרי הקו הכחול במפה.'
                : 'המפקדת סיימה את התדריך. עכשיו: למשרד החוקרים, אל השולחן החדש שלך, לקחת את התיק הראשון.'}
            </p>
            <button className="btn-primary mt-3 w-full" onClick={onOpenMap}>
              <Compass className="h-4 w-4" />
              חזרה למפת התחנה
            </button>
          </div>
        )}

        {arrivalStep === 'done' && !caseFile && upcoming && (
          <div className="panel border-evidence/60 p-4">
            <div className="mb-1 flex items-center gap-2 text-evidence-light">
              <Folder className="h-5 w-5" />
              <span className="text-xs font-bold">תיק חדש על השולחן</span>
            </div>
            <p className="text-sm text-slate-300">
              תיק חדש הונח על השולחן שלך במשרד החוקרים. גשו לשולחן בתחנה כדי לפתוח אותו.
            </p>
            <button className="btn-gold mt-3 w-full" onClick={onOpenMap}>
              <MapPin className="h-4 w-4" />
              ניווט לשולחן
            </button>
          </div>
        )}

        {arrivalStep === 'done' && !caseFile && !upcoming && (
          <div className="panel border-evidence/60 p-4 text-center">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-evidence-light" />
            <div className="font-display text-lg font-black">
              {RANKS[profile.rankIndex]} {profile.name}
            </div>
            <p className="mt-1 text-sm text-slate-300">
              כל התיקים במרחב נסגרו. ראש מחלק פשעים, תחנת שרפשטיין. הניקוד המודיעיני הסופי: {profile.intelPoints}.
            </p>
          </div>
        )}

        {caseFile && progress && (
          <>
            <div className="panel overflow-hidden">
              <div className="border-b border-noir-border bg-cork/50 p-4">
                <div className="mb-1 flex items-center gap-2 text-evidence-light">
                  <Folder className="h-5 w-5" />
                  <span className="text-xs font-bold">
                    תיק חקירה #{caseFile.order} · {caseFile.crimeType}
                  </span>
                </div>
                <h2 className="font-display text-lg font-black leading-snug">{caseFile.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{caseFile.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {caseFile.mapIds
                    .filter((id) => id !== 'station')
                    .map((id) => (
                      <span key={id} className="label-tag bg-noir-deep text-steel">
                        <MapPin className="h-3 w-3" />
                        {MAPS[id].name}
                      </span>
                    ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3">
                <button className="btn-primary" onClick={onOpenTravel}>
                  <Compass className="h-4 w-4" />
                  יציאה לשטח
                </button>
                <button className="btn-gold" onClick={onOpenBoard}>
                  <Crosshair className="h-4 w-4" />
                  לוח ראיות
                </button>
                <button className="btn-ghost col-span-2" disabled={!progress.warrantSuspectId} onClick={onOpenInterrogation}>
                  {progress.warrantSuspectId ? <Unlock className="h-4 w-4 text-alert" /> : <Lock className="h-4 w-4" />}
                  חדר חקירות באזהרה
                </button>
              </div>
              {pendingLab > 0 && (
                <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-evidence/40 bg-evidence/10 p-2 text-xs text-amber-100">
                  <Fingerprint className="h-4 w-4 shrink-0 text-evidence-light" />
                  {pendingLab} ראיות ממתינות לניתוח. גשו למעבדת מז״פ בתחנה.
                </div>
              )}
            </div>

            <div className="panel p-3">
              <div className="mb-2 flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-police-light" />
                <h3 className="font-display font-bold">משימות חקירה</h3>
              </div>
              <ul className="space-y-1.5">
                {objectives.map((o) => (
                  <li key={o.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        o.done ? 'border-emerald-600 bg-emerald-900/60 text-emerald-300' : 'border-noir-border text-transparent'
                      }`}
                    >
                      <CheckSquare className="h-3.5 w-3.5" />
                    </span>
                    <span className={o.done ? 'text-steel line-through' : 'text-slate-200'}>{o.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-3">
              <div className="mb-2 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-alert" />
                <h3 className="font-display font-bold">חשודים</h3>
              </div>
              <div className="space-y-2">
                {caseFile.suspects.map((s) => {
                  const cleared = isSuspectCleared(progress, s.id);
                  const arrested = progress.warrantSuspectId === s.id;
                  return (
                    <div key={s.id} className="flex gap-3 rounded-lg border border-noir-border bg-noir-deep/60 p-2.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-noir-panel text-steel">
                        <UserCheck className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold">{s.name}</span>
                          <span className="text-xs text-steel">{s.age}</span>
                          {cleared && <span className="label-tag bg-police/20 text-police-light">נוקה מחשד</span>}
                          {arrested && <span className="label-tag bg-alert/20 text-red-300">עצור</span>}
                        </div>
                        <div className="text-[11px] font-bold text-evidence-light">{s.occupation}</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-steel">{s.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="panel p-3">
          <div className="mb-2 flex items-center gap-2">
            <Folder className="h-5 w-5 text-steel" />
            <h3 className="font-display font-bold">ארכיון תיקים</h3>
          </div>
          <div className="space-y-1.5">
            {cases.map((c) => {
              const solved = profile.solvedCases.includes(c.id);
              const unlocked = isCaseUnlocked(c.id, profile.solvedCases);
              const active = caseFile?.id === c.id;
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-noir-border bg-noir-deep/50 p-2">
                  {solved ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : unlocked ? (
                    <Unlock className="h-4 w-4 shrink-0 text-evidence-light" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-steel" />
                  )}
                  <span className={`flex-1 text-sm ${unlocked ? 'text-slate-200' : 'text-steel'}`}>{c.shortTitle}</span>
                  <span className="text-[11px] text-steel">
                    {solved ? `נסגר · ${allProgress[c.id]?.score ?? 0} נק׳` : active ? 'פעיל' : unlocked ? 'ממתין' : 'נעול'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
