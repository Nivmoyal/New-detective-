import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Crosshair,
  FileText,
  Fingerprint,
  Folder,
  Key,
  Lock,
  MessageSquare,
  Search,
  ShieldAlert,
  Unlock,
  UserCheck,
  Video,
  X,
} from 'lucide-react';
import type { CaseFile, CaseProgress, Clue, EvidenceCategory, LinkVerdict } from '../types/investigation';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  WARRANT_THRESHOLD,
  buildEvidenceNodes,
  clueDisplayText,
  evaluateDeduction,
  getClue,
} from '../services/caseEngine';

interface Props {
  caseFile: CaseFile;
  progress: CaseProgress;
  onLink: (suspectId: string, evidenceId: string) => LinkVerdict;
  onRemoveLink: (suspectId: string, evidenceId: string) => void;
  onIssueWarrant: (suspectId: string) => void;
  onStartInterrogation: () => void;
}

type Selection = { kind: 'suspect' | 'evidence'; id: string } | null;
type Feedback = { tone: 'good' | 'bad' | 'info'; text: string } | null;

const SOURCE_ICON: Record<Clue['source'], React.ReactNode> = {
  physical: <Search className="h-3.5 w-3.5" />,
  testimony: <MessageSquare className="h-3.5 w-3.5" />,
  cctv: <Video className="h-3.5 w-3.5" />,
  forensic: <Fingerprint className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
};

const CATEGORY_STYLE: Record<EvidenceCategory, string> = {
  clue: 'border-t-evidence-light',
  motive: 'border-t-alert',
  alibi: 'border-t-police-light',
};

interface Line {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  verdict: 'implicates' | 'clears';
}

export default function EvidenceBoard({ caseFile, progress, onLink, onRemoveLink, onIssueWarrant, onStartInterrogation }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [selection, setSelection] = useState<Selection>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [focusClue, setFocusClue] = useState<Clue | null>(null);

  const nodes = useMemo(() => buildEvidenceNodes(caseFile, progress), [caseFile, progress]);
  const suspects = nodes.filter((n) => n.kind === 'suspect');
  const evidence = nodes.filter((n) => n.kind !== 'suspect');
  const deductions = useMemo(() => evaluateDeduction(caseFile, progress), [caseFile, progress]);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el);
    else nodeRefs.current.delete(id);
  };

  const measure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const base = board.getBoundingClientRect();
    const next: Line[] = [];
    for (const link of progress.links) {
      const a = nodeRefs.current.get(link.suspectId)?.getBoundingClientRect();
      const b = nodeRefs.current.get(link.evidenceId)?.getBoundingClientRect();
      if (!a || !b) continue;
      next.push({
        key: `${link.suspectId}-${link.evidenceId}`,
        x1: a.left + a.width / 2 - base.left,
        y1: a.top + a.height - 6 - base.top,
        x2: b.left + b.width / 2 - base.left,
        y2: b.top + 8 - base.top,
        verdict: link.verdict,
      });
    }
    setLines(next);
  }, [progress.links]);

  useLayoutEffect(() => {
    measure();
    const board = boardRef.current;
    if (!board) return;
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, nodes.length]);

  const attemptLink = (suspectId: string, evidenceId: string) => {
    const clue = getClue(caseFile, evidenceId);
    const suspect = caseFile.suspects.find((s) => s.id === suspectId);
    if (!clue || !suspect) return;
    if (progress.links.some((l) => l.suspectId === suspectId && l.evidenceId === evidenceId)) {
      setFeedback({ tone: 'info', text: 'החיבור הזה כבר קיים על הלוח.' });
      return;
    }
    const verdict = onLink(suspectId, evidenceId);
    if (verdict === 'implicates') {
      setFeedback({ tone: 'good', text: `חיבור מאומת: "${clue.title}" מצביע/ה על ${suspect.name}.` });
    } else if (verdict === 'clears') {
      setFeedback({ tone: 'good', text: `אליבי מאומת: ${suspect.name} נוקה מחשד על סמך "${clue.title}".` });
    } else {
      setFeedback({ tone: 'bad', text: `החיבור לא מחזיק. "${clue.title}" לא קשור/ה ל${suspect.name}. האמינות שלכם נפגעה.` });
    }
    setSelection(null);
  };

  const tapSuspect = (id: string) => {
    if (selection?.kind === 'evidence') return attemptLink(id, selection.id);
    setSelection(selection?.id === id ? null : { kind: 'suspect', id });
    setFeedback({ tone: 'info', text: 'בחרו ראיה מהלוח כדי למתוח אליה חוט.' });
  };

  const tapEvidence = (id: string, pendingLab: boolean) => {
    if (pendingLab) {
      setFeedback({ tone: 'info', text: 'הראיה ממתינה לניתוח במעבדת מז״פ. אי אפשר להצמיד אותה ללוח לפני שיש תוצאה.' });
      return;
    }
    if (selection?.kind === 'suspect') return attemptLink(selection.id, id);
    setSelection(selection?.id === id ? null : { kind: 'evidence', id });
    setFeedback({ tone: 'info', text: 'בחרו חשוד כדי למתוח אליו חוט מהראיה.' });
  };

  const warrantSuspect = progress.warrantSuspectId
    ? caseFile.suspects.find((s) => s.id === progress.warrantSuspectId)
    : null;

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-3 p-3 pb-6">
        <div className="panel p-3">
          <div className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-evidence-light" />
            <h2 className="font-display text-lg font-bold">לוח ראיות וחיבור קשרים</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-steel">
            הקישו על חשוד ואז על ראיה (או להפך) כדי למתוח חוט. חוט אדום מסמן ראיה מפלילה, חוט כחול מסמן אליבי שמנקה.
            {` ${WARRANT_THRESHOLD} חוטים אדומים לאותו חשוד מאפשרים הוצאת צו מעצר.`}
          </p>
        </div>

        {feedback && (
          <div
            className={`flex animate-fadeUp items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
              feedback.tone === 'good'
                ? 'border-emerald-700 bg-emerald-950/60 text-emerald-200'
                : feedback.tone === 'bad'
                  ? 'border-alert bg-red-950/60 text-red-200'
                  : 'border-noir-border bg-noir-panel text-slate-300'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {feedback.tone === 'good' ? <CheckSquare className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            </span>
            <span className="flex-1">{feedback.text}</span>
            <button onClick={() => setFeedback(null)} aria-label="סגירה" className="shrink-0 text-steel">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Corkboard */}
        <div ref={boardRef} className="cork-texture relative overflow-hidden rounded-xl border-4 border-[#4a3420] p-3 shadow-inner">
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden>
            {lines.map((l) => {
              const midY = (l.y1 + l.y2) / 2 + 18;
              const color = l.verdict === 'implicates' ? '#dc2626' : '#3b82f6';
              return (
                <g key={l.key}>
                  <path
                    d={`M ${l.x1} ${l.y1} Q ${(l.x1 + l.x2) / 2} ${midY} ${l.x2} ${l.y2}`}
                    stroke="rgba(0,0,0,0.25)"
                    strokeWidth={3}
                    fill="none"
                    transform="translate(1.5 2)"
                  />
                  <path d={`M ${l.x1} ${l.y1} Q ${(l.x1 + l.x2) / 2} ${midY} ${l.x2} ${l.y2}`} stroke={color} strokeWidth={2} strokeOpacity={0.72} fill="none" />
                </g>
              );
            })}
          </svg>

          <div className="mb-1 text-[11px] font-bold tracking-wide text-amber-200/70">חשודים</div>
          <div className="relative z-0 mb-6 grid grid-cols-3 gap-2">
            {suspects.map((n, i) => {
              if (n.kind !== 'suspect') return null;
              const d = deductions.find((x) => x.suspectId === n.id)!;
              const selected = selection?.id === n.id;
              return (
                <button
                  key={n.id}
                  ref={setRef(n.id)}
                  onClick={() => tapSuspect(n.id)}
                  style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 1.2}deg)` }}
                  className={`relative rounded-sm bg-[#e8e2d4] p-1.5 pt-3 text-right text-slate-900 shadow-lg transition ${
                    selected ? 'ring-4 ring-police-light' : ''
                  } ${n.cleared ? 'opacity-60' : ''}`}
                >
                  <span className="absolute left-1/2 top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-alert shadow" />
                  <div className="mb-1 flex aspect-[4/3] items-center justify-center bg-slate-800 text-slate-400">
                    <UserCheck className="h-8 w-8" />
                  </div>
                  <div className="truncate text-[12px] font-black leading-tight">{n.suspect.name}</div>
                  <div className="truncate text-[10px] text-slate-600">{n.suspect.occupation}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-bold">
                    {n.cleared ? (
                      <span className="text-police">נוקה מחשד</span>
                    ) : (
                      <span className={d.validatedCount >= WARRANT_THRESHOLD ? 'text-alert' : 'text-slate-700'}>
                        {d.validatedCount}/{WARRANT_THRESHOLD}
                      </span>
                    )}
                    {progress.warrantSuspectId === n.id && <Lock className="h-3 w-3 text-alert" />}
                  </div>
                  {n.cleared && (
                    <span className="absolute inset-x-0 top-[28%] -rotate-12 border-y-2 border-police bg-white/70 py-0.5 text-center text-[10px] font-black text-police">
                      אליבי מאומת
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {evidence.length === 0 ? (
            <div className="relative z-0 rounded-md border border-dashed border-amber-200/30 p-6 text-center text-sm text-amber-100/70">
              <Folder className="mx-auto mb-2 h-6 w-6" />
              הלוח ריק. צאו לשטח, אספו ראיות ותשאלו עדים.
            </div>
          ) : (
            (['clue', 'motive', 'alibi'] as EvidenceCategory[]).map((cat) => {
              const items = evidence.filter((n) => n.kind === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="relative z-0 mb-4">
                  <div className="mb-1 text-[11px] font-bold tracking-wide text-amber-200/70">{CATEGORY_LABELS[cat]}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((n, i) => {
                      if (!('clue' in n)) return null;
                      const selected = selection?.id === n.id;
                      const linked = progress.links.some((l) => l.evidenceId === n.id);
                      return (
                        <div
                          key={n.id}
                          ref={setRef(n.id)}
                          style={{ transform: `rotate(${((i + cat.length) % 3) - 1}deg)` }}
                          className={`relative rounded-sm border-t-4 bg-[#f4efe3] p-2 pt-3 text-right text-slate-900 shadow-lg ${CATEGORY_STYLE[cat]} ${
                            selected ? 'ring-4 ring-police-light' : ''
                          } ${n.pendingLab ? 'opacity-70' : ''}`}
                        >
                          <span
                            className={`absolute left-1/2 top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full shadow ${
                              linked ? 'bg-alert' : 'bg-slate-500'
                            }`}
                          />
                          <button className="block w-full text-right" onClick={() => tapEvidence(n.id, n.pendingLab)}>
                            <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-slate-600">
                              {SOURCE_ICON[n.clue.source]}
                              {SOURCE_LABELS[n.clue.source]}
                            </div>
                            <div className="text-[12px] font-black leading-snug">{n.clue.title}</div>
                          </button>
                          <div className="mt-1 flex items-center justify-between">
                            {n.pendingLab ? (
                              <span className="label-tag bg-amber-200 text-amber-900">ממתין למז״פ</span>
                            ) : (
                              <span />
                            )}
                            <button
                              onClick={() => setFocusClue(n.clue)}
                              className="text-[10px] font-bold text-police underline"
                            >
                              פרטים
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Deduction engine */}
        <div className="panel p-3">
          <div className="mb-2 flex items-center gap-2">
            <Key className="h-5 w-5 text-evidence-light" />
            <h3 className="font-display font-bold">מנוע הסקת מסקנות</h3>
          </div>
          <div className="space-y-2">
            {deductions.map((d) => {
              const suspect = caseFile.suspects.find((s) => s.id === d.suspectId)!;
              const links = progress.links.filter((l) => l.suspectId === d.suspectId);
              return (
                <div key={d.suspectId} className="rounded-lg border border-noir-border bg-noir-deep/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-bold">{suspect.name}</div>
                    {d.cleared ? (
                      <span className="label-tag bg-police/20 text-police-light">
                        <Unlock className="h-3 w-3" /> נוקה
                      </span>
                    ) : (
                      <span className="text-xs text-steel">
                        {d.validatedCount}/{WARRANT_THRESHOLD} ראיות מאומתות
                      </span>
                    )}
                  </div>
                  {!d.cleared && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-noir-border">
                      <div
                        className="h-full rounded-full bg-alert transition-all"
                        style={{ width: `${Math.min(100, (d.validatedCount / WARRANT_THRESHOLD) * 100)}%` }}
                      />
                    </div>
                  )}
                  {links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {links.map((l) => (
                        <span
                          key={l.evidenceId}
                          className={`label-tag ${l.verdict === 'implicates' ? 'bg-red-950 text-red-300' : 'bg-blue-950 text-blue-300'}`}
                        >
                          {getClue(caseFile, l.evidenceId)?.title}
                          <button onClick={() => onRemoveLink(l.suspectId, l.evidenceId)} aria-label="ניתוק חוט">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {d.canIssueWarrant && !progress.warrantSuspectId && (
                    <button className="btn-danger mt-2 w-full" onClick={() => onIssueWarrant(d.suspectId)}>
                      <Lock className="h-4 w-4" />
                      הוצאת צו מעצר נגד {suspect.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {warrantSuspect && (
            <div className="mt-3 rounded-lg border border-alert/60 bg-red-950/40 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-200">
                <Lock className="h-4 w-4" />
                צו מעצר נחתם: {warrantSuspect.name} עצור ומחכה בחדר החקירות.
              </div>
              <button className="btn-primary mt-2 w-full" onClick={onStartInterrogation}>
                <ShieldAlert className="h-4 w-4" />
                פתיחת חקירה באזהרה
              </button>
            </div>
          )}
        </div>
      </div>

      {focusClue && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setFocusClue(null)}>
          <div className="panel w-full max-w-md animate-fadeUp p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-2 text-evidence-light">
              {SOURCE_ICON[focusClue.source]}
              <span className="text-xs font-bold">
                {CATEGORY_LABELS[focusClue.category]} · {SOURCE_LABELS[focusClue.source]}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold">{focusClue.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{clueDisplayText(focusClue, progress)}</p>
            {focusClue.requiresLab && progress.analyzed.includes(focusClue.id) && (
              <p className="mt-2 rounded-md bg-noir-deep p-2 text-xs text-steel">
                <span className="font-bold text-sky-300">ממצא ראשוני: </span>
                {focusClue.description}
              </p>
            )}
            <button className="btn-ghost mt-4 w-full" onClick={() => setFocusClue(null)}>
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
