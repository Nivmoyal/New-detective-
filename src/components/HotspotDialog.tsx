import { useState } from 'react';
import { CheckSquare, ChevronLeft, FileText, MessageSquare, Search, Video } from 'lucide-react';
import type { CaseFile, CaseProgress, MapHotspot } from '../types/investigation';
import { CATEGORY_LABELS, getClue, SOURCE_LABELS } from '../services/caseEngine';

interface Props {
  hotspot: MapHotspot;
  caseFile: CaseFile;
  progress: CaseProgress;
  onCollect: () => void;
  onClose: () => void;
}

const KIND_META = {
  collect: { icon: <Search className="h-5 w-5" />, label: 'איסוף ראיה' },
  witness: { icon: <MessageSquare className="h-5 w-5" />, label: 'תשאול עד' },
  cctv: { icon: <Video className="h-5 w-5" />, label: 'בדיקת מצלמות אבטחה' },
};

export default function HotspotDialog({ hotspot, caseFile, progress, onCollect, onClose }: Props) {
  const [alreadyVisited] = useState(() => progress.visitedHotspots.includes(hotspot.id));
  const [step, setStep] = useState(alreadyVisited ? hotspot.dialogue.length : 0);
  const [collected, setCollected] = useState(alreadyVisited);
  const finished = step >= hotspot.dialogue.length;
  const meta = KIND_META[hotspot.kind];

  const advance = () => {
    const next = step + 1;
    setStep(next);
    if (next >= hotspot.dialogue.length && !collected) {
      setCollected(true);
      onCollect();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="panel max-h-[88vh] w-full max-w-lg animate-fadeUp overflow-y-auto p-4 shadow-2xl scrollbar-thin">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-evidence/15 text-evidence-light">{meta.icon}</span>
          <div>
            <div className="text-[11px] font-bold text-evidence-light">{hotspot.label || meta.label}</div>
            <div className="font-display text-base font-bold">{hotspot.title}</div>
          </div>
        </div>

        <div className="space-y-2">
          {hotspot.dialogue.slice(0, Math.max(1, step + (finished ? 0 : 1))).map((line, i) => (
            <div key={i} className="animate-fadeUp rounded-lg border border-noir-border bg-noir-deep/70 p-3">
              <div className="mb-0.5 text-[11px] font-bold text-sky-300">{line.speaker}</div>
              <p className="text-sm leading-relaxed text-slate-200">{line.text}</p>
            </div>
          ))}
        </div>

        {finished && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <CheckSquare className="h-4 w-4" />
              {alreadyVisited ? 'הנקודה כבר נבדקה. הראיות שנאספו:' : 'נוסף לתיק החקירה:'}
            </div>
            {hotspot.evidenceIds.map((id) => {
              const clue = getClue(caseFile, id);
              if (!clue) return null;
              return (
                <div key={id} className="rounded-lg border border-evidence/50 bg-evidence/10 p-3">
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-bold text-evidence-light">
                    <FileText className="h-3.5 w-3.5" />
                    {CATEGORY_LABELS[clue.category]} · {SOURCE_LABELS[clue.source]}
                    {clue.requiresLab && !progress.analyzed.includes(clue.id) && ' · דורש ניתוח מז״פ'}
                  </div>
                  <div className="text-sm font-bold">{clue.title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-steel">{clue.description}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {!finished ? (
            <button className="btn-primary" onClick={advance}>
              המשך
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : (
            <button className="btn-gold" onClick={onClose}>
              חזרה לסיור
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
