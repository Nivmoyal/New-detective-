import { useEffect, useState } from 'react';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import type { ChatNpc } from '../data/characters';
import CharacterBanner from './CharacterBanner';
import { genderize } from '../pixel/world/humor';

interface Props {
  npc: ChatNpc;
  /** How many of the character's lines were already heard in earlier conversations. */
  heard: number;
  /** What they say once there is nothing new to tell. */
  annoyed: string;
  addressForm: 'male' | 'female';
  onHeard: (count: number) => void;
  onClose: () => void;
}

/** A conversation that picks up where the last one ended, in the order the person would tell it. */
export default function ChatDialog({ npc, heard, annoyed, addressForm, onHeard, onClose }: Props) {
  // Everything is fixed when the conversation opens: the record of what was
  // heard changes while talking, and must not move the lines under the reader.
  // Lines only advance when the button is pressed.
  const [{ start, fresh, lines }] = useState(() => {
    const isFresh = heard < npc.lines.length;
    // Nothing new: a grumble, then one thing they already said, to jog the memory.
    const list = (isFresh ? npc.lines.slice(heard) : [annoyed, npc.lines[npc.lines.length - 1]]).map((l) => genderize(l, addressForm));
    return { start: heard, fresh: isFresh, lines: list };
  });
  const [i, setI] = useState(0);

  const next = () => {
    const n = Math.min(i + 1, lines.length - 1);
    setI(n);
    if (fresh) onHeard(start + n + 1);
  };

  // The first line counts as heard as soon as it is shown.
  useEffect(() => {
    if (fresh) onHeard(start + 1);
    // Only once, when the conversation opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="panel w-full max-w-lg animate-fadeUp overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CharacterBanner character={npc.character} />
        <div className="p-4">
          <p key={i} className="min-h-[4.5rem] animate-fadeUp text-[15px] leading-relaxed text-slate-200">
            {lines[i]}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {lines.length > 1 && lines.map((_, k) => <span key={k} className={`h-1.5 w-4 rounded-full ${k <= i ? 'bg-evidence-light' : 'bg-noir-border'}`} />)}
            </div>
            <div className="flex gap-2">
              {i < lines.length - 1 && (
                <button className="btn-ghost" onClick={next}>
                  <MessageSquare className="h-4 w-4" />
                  {fresh ? 'ועוד?' : 'רגע, מה אמרת קודם?'}
                </button>
              )}
              <button className="btn-primary" onClick={onClose}>
                תודה
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
