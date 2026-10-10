import { useState } from 'react';
import { Activity, Award, CheckSquare, Menu, RotateCcw, ShieldAlert, Siren, X } from 'lucide-react';
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
    <header className="relative z-20 border-b border-noir-border bg-noir-panel/95 px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex items-center gap-2">
        <Siren className="h-4 w-4 shrink-0 text-police-light" />
        <div className="min-w-0 flex-1 truncate text-xs leading-tight">
          <span className="font-bold text-slate-100">
            {RANKS[profile.rankIndex]} {profile.name}
          </span>
          {activeCaseTitle && <span className="text-evidence-light"> · {activeCaseTitle}</span>}
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-bold ${reliabilityTone}`} title="אמינות">
          <ShieldAlert className="h-3.5 w-3.5" />
          {profile.reliability}%
        </span>
        <button className="shrink-0 rounded-md p-1 text-steel hover:text-slate-100" onClick={() => setMenuOpen((v) => !v)} aria-label="תפריט">
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {menuOpen && (
        <div className="panel absolute left-3 top-10 z-30 w-64 animate-fadeUp p-3 shadow-2xl">
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <Stat icon={<Award className="h-3.5 w-3.5" />} label={RANK_TITLES[profile.rankIndex]} value={RANKS[profile.rankIndex]} tone="text-evidence-light" />
            <Stat icon={<CheckSquare className="h-3.5 w-3.5" />} label="תיקים פתורים" value={profile.solvedCases.length} tone="text-police-light" />
            <Stat icon={<ShieldAlert className="h-3.5 w-3.5" />} label="אמינות" value={`${profile.reliability}%`} tone={reliabilityTone} />
            <Stat icon={<Activity className="h-3.5 w-3.5" />} label="ניקוד מודיעיני" value={profile.intelPoints} tone="text-sky-300" />
          </div>
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
