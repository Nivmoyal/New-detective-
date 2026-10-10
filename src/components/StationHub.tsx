import { CheckSquare, Crosshair, Fingerprint, Folder, FolderOpen, Lock, MapPin, ShieldAlert, Unlock, UserCheck } from 'lucide-react';
import type { ArrivalStep, CaseProgress, DetectiveProfile } from '../types/investigation';
import { MAPS } from '../data/maps';
import { getCase, isSuspectCleared, loadCases, pendingLabClues } from '../services/caseEngine';

interface Props {
  profile: DetectiveProfile;
  arrivalStep: ArrivalStep;
  knownCaseIds: string[];
  activeCaseId: string | null;
  allProgress: Record<string, CaseProgress>;
  onFocus: (caseId: string) => void;
  onOpenBoard: () => void;
  onOpenInterrogation: () => void;
}

/** The detective's case files. Every open case is available; nothing is assigned. */
export default function StationHub({ profile, arrivalStep, knownCaseIds, activeCaseId, allProgress, onFocus, onOpenBoard, onOpenInterrogation }: Props) {
  const cases = loadCases().filter((c) => knownCaseIds.includes(c.id));
  const active = activeCaseId ? getCase(activeCaseId) : null;
  const progress = activeCaseId ? allProgress[activeCaseId] : null;
  const allDone = cases.length > 0 && loadCases().every((c) => profile.solvedCases.includes(c.id));

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-2xl space-y-3 p-3 pb-6">
        {cases.length === 0 && (
          <div className="panel p-4 text-sm leading-relaxed text-slate-300">
            {arrivalStep === 'toCommander' || arrivalStep === 'toDesk'
              ? 'התיק האישי שלך ריק. תיקי החקירה הפתוחים של המרחב מונחים על השולחן שלך במשרד החוקרים בתחנה.'
              : 'אין תיקים פתוחים.'}
          </div>
        )}

        {allDone && (
          <div className="panel border-evidence/60 p-4 text-center">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-evidence-light" />
            <p className="text-sm text-slate-300">כל התיקים במרחב נסגרו. הניקוד המודיעיני הסופי: {profile.intelPoints}.</p>
          </div>
        )}

        {cases.length > 0 && (
          <div className="panel p-3">
            <div className="mb-2 flex items-center gap-2">
              <Folder className="h-5 w-5 text-evidence-light" />
              <h3 className="font-display font-bold">תיקי חקירה</h3>
            </div>
            <div className="space-y-1.5">
              {cases.map((c) => {
                const p = allProgress[c.id];
                const solved = profile.solvedCases.includes(c.id);
                const focused = c.id === activeCaseId;
                return (
                  <button
                    key={c.id}
                    onClick={() => onFocus(c.id)}
                    className={`flex w-full items-center gap-2 rounded-lg border p-2.5 text-right transition ${
                      focused ? 'border-evidence-light bg-evidence/10' : 'border-noir-border bg-noir-deep/50 hover:border-slate-600'
                    }`}
                  >
                    {solved ? (
                      <CheckSquare className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : focused ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-evidence-light" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-steel" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-100">{c.shortTitle}</span>
                      <span className="block text-[11px] text-steel">{c.crimeType} · {c.locationName}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-steel">
                      {solved ? `נסגר · ${p?.score ?? 0} נק׳` : `${p?.collected.length ?? 0} ראיות`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {active && progress && (
          <>
            <div className="panel overflow-hidden">
              <div className="border-b border-noir-border bg-cork/50 p-4">
                <div className="mb-1 flex items-center gap-2 text-evidence-light">
                  <FolderOpen className="h-5 w-5" />
                  <span className="text-xs font-bold">{active.crimeType}</span>
                </div>
                <h2 className="font-display text-lg font-black leading-snug">{active.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{active.summary}</p>
                <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-400">
                  {active.briefing.map((b, i) => (
                    <p key={i}>{b}</p>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {active.mapIds
                    .filter((id) => id !== 'station')
                    .slice(0, 1)
                    .map((id) => (
                      <span key={id} className="label-tag bg-noir-deep text-steel">
                        <MapPin className="h-3 w-3" />
                        זירת האירוע: {MAPS[id].name}
                      </span>
                    ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3">
                <button className="btn-gold" onClick={onOpenBoard}>
                  <Crosshair className="h-4 w-4" />
                  לוח ראיות
                </button>
                <button className="btn-ghost" disabled={!progress.warrantSuspectId || progress.solved} onClick={onOpenInterrogation}>
                  {progress.warrantSuspectId && !progress.solved ? <Unlock className="h-4 w-4 text-alert" /> : <Lock className="h-4 w-4" />}
                  חדר חקירות
                </button>
              </div>
              {pendingLabClues(active, progress).length > 0 && (
                <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-evidence/40 bg-evidence/10 p-2 text-xs text-amber-100">
                  <Fingerprint className="h-4 w-4 shrink-0 text-evidence-light" />
                  {pendingLabClues(active, progress).length} פריטים פיזיים עדיין לא עברו מעבדה.
                </div>
              )}
            </div>

            <div className="panel p-3">
              <div className="mb-2 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-alert" />
                <h3 className="font-display font-bold">חשודים</h3>
              </div>
              <div className="space-y-2">
                {active.suspects.map((s) => {
                  const cleared = isSuspectCleared(progress, s.id);
                  const arrested = progress.warrantSuspectId === s.id;
                  return (
                    <div key={s.id} className="rounded-lg border border-noir-border bg-noir-deep/60 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold">{s.name}</span>
                        <span className="text-xs text-steel">{s.age}</span>
                        {cleared && <span className="label-tag bg-police/20 text-police-light">נוקה מחשד</span>}
                        {arrested && <span className="label-tag bg-alert/20 text-red-300">עצור</span>}
                      </div>
                      <div className="text-[11px] font-bold text-evidence-light">{s.occupation}</div>
                      <p className="mt-0.5 text-xs leading-relaxed text-steel">{s.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
