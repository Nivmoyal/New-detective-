import { useState } from 'react';
import { Activity, Award, CheckSquare, RotateCcw, ShieldAlert, Siren, X } from 'lucide-react';
import type { DetectiveProfile } from '../types/investigation';
import { RANKS, RANK_TITLES } from '../services/caseEngine';

interface Props {
  profile: DetectiveProfile;
  activeCaseTitle: string | null;
  onReset: () => void;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-noir-border bg-noir-deep/70 px-1.5 py-1 text-center">
      <div className="whitespace-nowrap text-[10px] leading-tight text-steel">{label}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1">
        <span className={tone}>{icon}</span>
        <span className="whitespace-nowrap text-xs font-bold text-slate-100">{value}</span>
      </div>
    </div>
  );
}

export default function PoliceHeader({ profile, activeCaseTitle, onReset }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const reliabilityTone =
    profile.reliability >= 70 ? 'text-emerald-400' : profile.reliability >= 40 ? 'text-evidence-light' : 'text-alert';

  return (
    <header className="relative z-20 border-b border-noir-border bg-noir-panel/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-police/60 bg-police/15">
            <Siren className="h-5 w-5 text-police-light" />
            <span className="absolute -left-0.5 -top-0.5 h-2 w-2 animate-siren rounded-full bg-alert" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-sm font-bold text-slate-100">
              {RANKS[profile.rankIndex]} {profile.name}
            </div>
            <div className="truncate text-[11px] text-steel">
              {RANK_TITLES[profile.rankIndex]} · תחנת שרפשטיין
            </div>
          </div>
        </div>
        <button className="btn-ghost shrink-0 px-2.5 py-1.5" onClick={() => setMenuOpen((v) => !v)} aria-label="תפריט">
          {menuOpen ? <X className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex gap-1.5">
        <Stat icon={<Award className="h-3.5 w-3.5" />} label="דרגה" value={RANKS[profile.rankIndex]} tone="text-evidence-light" />
        <Stat
          icon={<CheckSquare className="h-3.5 w-3.5" />}
          label="תיקים פתורים"
          value={profile.solvedCases.length}
          tone="text-police-light"
        />
        <Stat icon={<ShieldAlert className="h-3.5 w-3.5" />} label="אמינות" value={`${profile.reliability}%`} tone={reliabilityTone} />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="ניקוד מודיעיני" value={profile.intelPoints} tone="text-sky-300" />
      </div>

      {activeCaseTitle && (
        <div className="mt-2 truncate rounded-md bg-evidence/10 px-2 py-1 text-[11px] font-bold text-evidence-light">
          תיק פעיל: {activeCaseTitle}
        </div>
      )}

      {menuOpen && (
        <div className="panel absolute left-3 top-14 z-30 w-64 animate-fadeUp p-3 shadow-2xl">
          <div className="mb-2 text-xs text-steel">
            התקדמות נשמרת אוטומטית במכשיר. איפוס יתחיל את המשמרת הראשונה מחדש.
          </div>
          {confirming ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-red-200">לאפס את כל ההתקדמות ולהתחיל מהיום הראשון בתחנה?</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="btn-danger"
                  onClick={() => {
                    onReset();
                    setConfirming(false);
                    setMenuOpen(false);
                  }}
                >
                  כן, לאפס
                </button>
                <button className="btn-ghost" onClick={() => setConfirming(false)}>
                  ביטול
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-danger w-full" onClick={() => setConfirming(true)}>
              <RotateCcw className="h-4 w-4" />
              איפוס משחק
            </button>
          )}
        </div>
      )}
    </header>
  );
}
