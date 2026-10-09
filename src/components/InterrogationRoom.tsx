import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  FileText,
  Lock,
  MessageSquare,
  ShieldAlert,
  Siren,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type { CaseFile, CaseProgress, CharacterLook, InterrogationState, TacticId } from '../types/investigation';
import InterrogationScene from './three/InterrogationScene';
import type { Mood } from './three/Humanoid';
import { collectedClues, isPendingLab, SOURCE_LABELS } from '../services/caseEngine';
import { MAX_MISTAKES, MAX_TURNS, TACTICS } from '../services/interrogationEngine';

interface Props {
  detectiveLook: CharacterLook;
  caseFile: CaseFile;
  progress: CaseProgress;
  session: InterrogationState;
  onTactic: (tactic: TacticId, evidenceId?: string) => void;
  onEnd: () => void;
}

const TACTIC_ICON: Record<TacticId, React.ReactNode> = {
  pressure: <Zap className="h-5 w-5" />,
  evidence: <FileText className="h-5 w-5" />,
  trust: <Users className="h-5 w-5" />,
  confront: <Siren className="h-5 w-5" />,
};

function Gauge({ label, value, tone, icon }: { label: string; value: number; tone: 'red' | 'blue'; icon: React.ReactNode }) {
  const danger = tone === 'red' && value >= 80;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-bold text-slate-300">
          {icon}
          {label}
        </span>
        <span className={`font-mono font-bold ${danger ? 'animate-siren text-alert' : 'text-slate-100'}`}>{value}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-noir-border bg-noir-deep">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            tone === 'red'
              ? 'bg-gradient-to-l from-alert via-orange-500 to-evidence'
              : 'bg-gradient-to-l from-police-light to-police'
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function InterrogationRoom({ detectiveLook, caseFile, progress, session, onTactic, onEnd }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const suspect = caseFile.suspects.find((s) => s.id === session.suspectId)!;
  const profile = suspect.interrogation!;
  const usable = collectedClues(caseFile, progress).filter((c) => !isPendingLab(c, progress));
  const done = session.status !== 'active';
  const breakPct = Math.min(100, Math.round((session.progress / profile.breakThreshold) * 100));

  const [suspectTalking, setSuspectTalking] = useState(false);
  const mood: Mood =
    session.status === 'confessed'
      ? 'broken'
      : session.status !== 'active'
        ? 'defiant'
        : session.tension >= 70
          ? 'tense'
          : session.cooperation < 20
            ? 'defiant'
            : 'neutral';

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
    const last = session.log[session.log.length - 1];
    if (last?.speaker !== 'suspect') return;
    setSuspectTalking(true);
    const t = window.setTimeout(() => setSuspectTalking(false), 2600);
    return () => window.clearTimeout(t);
  }, [session.log]);

  return (
    <div className="flex h-full flex-col">
      {/* Suspect panel */}
      <div className="relative h-44 shrink-0 sm:h-56">
        {suspect.look && (
          <InterrogationScene
            suspect={suspect.look}
            detective={detectiveLook}
            tension={session.tension}
            mood={mood}
            talking={suspectTalking}
            className="absolute inset-0"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-noir-panel to-transparent" />
      </div>
      <div className="relative border-b border-noir-border bg-noir-panel p-3 pt-1">
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-alert">
              <Lock className="h-3.5 w-3.5" /> חקירה באזהרה · עצור
            </div>
            <div className="truncate font-display text-lg font-bold">{suspect.name}</div>
            <div className="truncate text-xs text-steel">
              {suspect.age} · {suspect.occupation}
            </div>
          </div>
          <div className="text-left text-[11px] leading-tight text-steel">
            <div>
              תור {Math.min(session.turn, MAX_TURNS)}/{MAX_TURNS}
            </div>
            <div className={session.mistakes > 0 ? 'text-alert' : ''}>
              טעויות {session.mistakes}/{MAX_MISTAKES}
            </div>
          </div>
        </div>
        <div className="relative mt-3 flex gap-3">
          <Gauge label="מד לחץ נפשי" value={session.tension} tone="red" icon={<Activity className="h-3.5 w-3.5" />} />
          <Gauge label="שיתוף פעולה" value={session.cooperation} tone="blue" icon={<Users className="h-3.5 w-3.5" />} />
        </div>
        <div className="relative mt-2">
          <div className="mb-0.5 text-[10px] text-steel">סדקים בגרסה</div>
          <div className="flex gap-1">
            {Array.from({ length: profile.breakThreshold }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < session.progress ? 'bg-evidence-light' : 'bg-noir-border'}`} />
            ))}
          </div>
          <span className="sr-only">{breakPct}%</span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={logRef} className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
        {session.log.map((entry, i) => {
          if (entry.speaker === 'system') {
            return (
              <div key={i} className="mx-auto max-w-md rounded-md border border-noir-border bg-noir-deep/70 px-3 py-1.5 text-center text-[11px] text-steel">
                {entry.text}
              </div>
            );
          }
          const isDetective = entry.speaker === 'detective';
          return (
            <div key={i} className={`flex animate-fadeUp ${isDetective ? 'justify-start' : 'justify-end'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  isDetective
                    ? 'rounded-tr-sm bg-police/25 text-blue-50'
                    : 'rounded-tl-sm border border-noir-border bg-noir-panel text-slate-200'
                }`}
              >
                <div className={`mb-0.5 text-[10px] font-bold ${isDetective ? 'text-blue-300' : 'text-evidence-light'}`}>
                  {isDetective ? 'חוקר/ת' : suspect.name}
                </div>
                {entry.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="border-t border-noir-border bg-noir-panel p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {done ? (
          <div className="space-y-2">
            <div
              className={`rounded-lg border p-3 text-sm font-bold ${
                session.status === 'confessed' ? 'border-emerald-700 bg-emerald-950/50 text-emerald-200' : 'border-alert bg-red-950/50 text-red-200'
              }`}
            >
              {session.status === 'confessed' && 'הודאה מלאה. התיק נסגר.'}
              {session.status === 'lawyer' && 'החשוד דרש עורך דין. החקירה הופסקה, והוא יוחזר לתא עד לחקירה חוזרת.'}
              {session.status === 'silent' && 'החשוד שומר על זכות השתיקה. תצטרכו לנסות שוב, עם גישה אחרת.'}
            </div>
            <button className={session.status === 'confessed' ? 'btn-gold w-full py-3' : 'btn-ghost w-full py-3'} onClick={onEnd}>
              {session.status === 'confessed' ? 'סגירת התיק ודיווח למפקדת' : 'חזרה לתיק'}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {TACTICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => (t.id === 'evidence' ? setPickerOpen(true) : onTactic(t.id))}
                  className="flex items-start gap-2 rounded-lg border border-noir-border bg-noir-deep p-2.5 text-right transition hover:border-police-light active:scale-[0.98]"
                >
                  <span className={t.id === 'pressure' || t.id === 'confront' ? 'text-alert' : t.id === 'trust' ? 'text-police-light' : 'text-evidence-light'}>
                    {TACTIC_ICON[t.id]}
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span className="line-clamp-2 block text-[10px] leading-snug text-steel">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
            <button className="mt-2 w-full text-center text-xs text-steel underline" onClick={onEnd}>
              הפסקת החקירה (ניתן לחזור מאוחר יותר)
            </button>
          </>
        )}
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setPickerOpen(false)}>
          <div className="panel max-h-[80vh] w-full max-w-md animate-fadeUp overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-noir-border p-3">
              <div className="flex items-center gap-2 font-bold">
                <FileText className="h-5 w-5 text-evidence-light" />
                בחירת ראיה להצגה
              </div>
              <button onClick={() => setPickerOpen(false)} aria-label="סגירה">
                <X className="h-5 w-5 text-steel" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto p-3 scrollbar-thin">
              {usable.length === 0 && <div className="text-center text-sm text-steel">אין ראיות זמינות בתיק.</div>}
              {usable.map((c) => {
                const shown = session.presented.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setPickerOpen(false);
                      onTactic('evidence', c.id);
                    }}
                    className={`w-full rounded-lg border p-2.5 text-right transition ${
                      shown ? 'border-noir-border bg-noir-deep/40 opacity-50' : 'border-noir-border bg-noir-deep hover:border-evidence-light'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] font-bold text-steel">
                      <MessageSquare className="h-3 w-3" />
                      {SOURCE_LABELS[c.source]}
                      {shown && ' · כבר הוצגה'}
                    </div>
                    <div className="text-sm font-bold">{c.title}</div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-noir-border p-2 text-center text-[11px] text-steel">
              <ShieldAlert className="ml-1 inline h-3.5 w-3.5" />
              ראיה שאינה קשורה לחשוד נחשבת לטעות טקטית.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
