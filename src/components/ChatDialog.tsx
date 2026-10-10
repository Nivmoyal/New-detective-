import { useState } from 'react';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import type { ChatNpc } from '../data/characters';
import CharacterBanner from './CharacterBanner';
import { genderize } from '../pixel/world/humor';

/** Free conversation with a station character: each tap brings the next line. */
export default function ChatDialog({
  npc,
  opener,
  addressForm,
  onClose,
}: {
  npc: ChatNpc;
  opener?: string;
  addressForm: 'male' | 'female';
  onClose: () => void;
}) {
  const lines = (opener ? [opener, ...npc.lines] : npc.lines).map((l) => genderize(l, addressForm));
  const [i, setI] = useState(() => (opener ? 0 : Math.floor(Math.random() * npc.lines.length)));
  const [count, setCount] = useState(1);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="panel w-full max-w-lg animate-fadeUp overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CharacterBanner character={npc.character} />
        <div className="p-4">
          <p key={i} className="min-h-[4.5rem] animate-fadeUp text-[15px] leading-relaxed text-slate-200">
            {lines[i]}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            {count < lines.length && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setI((v) => (v + 1) % lines.length);
                  setCount((c) => c + 1);
                }}
              >
                <MessageSquare className="h-4 w-4" />
                עוד משהו?
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
  );
}
