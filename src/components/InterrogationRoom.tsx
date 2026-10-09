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
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 font-bold text-slate-300">
          {icon}
          {label}
        </span>
        <span className={`font-mono font-bold ${danger ? 'animate-siren text-alert' : 'text-slate-100'}`}>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full border border-noir-border bg-noir-deep">
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
      {/* Suspect: compact 3D scene with the latest line as a speech bubble */}
      <div className="relative h-36 shrink-0 overflow-hidden sm:h-48">
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
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-6 pt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-300">
              <Lock className="h-3 w-3" /> חקירה באזהרה
            </div>
            <div className="truncate font-display text-base font-bold leading-tight">{suspect.name}</div>
          </div>
          <div className="shrink-0 text-left text-[10px] leading-tight text-slate-300">
            <div>
              תור {Math.min(session.turn, MAX_TURNS)}/{MAX_TURNS}
            </div>
            <div className={session.mistakes > 0 ? 'text-red-300' : ''}>
              טעויות {session.mistakes}/{MAX_MISTAKES}
            </div>
          </div>
        </div>
      </div>
      <div className="shrink-0 space-y-1.5 border-b border-noir-border bg-noir-panel px-3 py-2">
        <div className="flex gap-3">
          <Gauge label="לחץ נפשי" value={session.tension} tone="red" icon={<Activity className="h-3 w-3" />} />
          <Gauge label="שיתוף פעולה" value={session.cooperation} tone="blue" icon={<Users className="h-3 w-3" />} />
        </div>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] text-steel">סדקים בגרסה</span>
          <div className="flex flex-1 gap-1">
            {Array.from({ length: profile.breakThreshold }).map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < session.progress ? 'bg-evidence-light' : 'bg-noir-border'}`} />
            ))}
          </div>
          <span className="sr-only">{breakPct}%</span>
        </div>
      </div>

      {/* Transcript */}
      <div ref={logRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-noir-deep/40 p-3 scrollbar-thin">
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
      <div className="shrink-0 border-t border-noir-border bg-noir-panel p-2">
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
            <div className="grid grid-cols-4 gap-1.5">
              {TACTICS.map((t) => (
                <button
                  key={t.id}
                  title={t.description}
                  onClick={() => (t.id === 'evidence' ? setPickerOpen(true) : onTactic(t.id))}
                  className="flex flex-col items-center gap-1 rounded-lg border border-noir-border bg-noir-deep px-1 py-2 text-center transition hover:border-police-light active:scale-[0.97]"
                >
                  <span className={t.id === 'pressure' || t.id === 'confront' ? 'text-alert' : t.id === 'trust' ? 'text-police-light' : 'text-evidence-light'}>
                    {TACTIC_ICON[t.id]}
                  </span>
                  <span className="text-[11px] font-bold leading-tight">{t.label}</span>
                </button>
              ))}
            </div>
            <button className="mt-1.5 w-full text-center text-[11px] text-steel underline" onClick={onEnd}>
              הפסקת החקירה
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
