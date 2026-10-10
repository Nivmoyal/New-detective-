import type { CharacterRef } from '../types/investigation';
import type { Expression } from '../pixel/person';
import PixelPortrait from './pixel/PixelPortrait';

interface Props {
  character: CharacterRef;
  talking?: boolean;
  tone?: 'police' | 'gold' | 'red';
  expression?: Expression;
}

/** Pixel-art bust of the person you are talking to. */
export default function CharacterBanner({ character, talking = true, tone = 'police', expression = 'neutral' }: Props) {
  const ring = tone === 'gold' ? 'from-evidence/25' : tone === 'red' ? 'from-alert/25' : 'from-police/25';
  return (
    <div className={`relative flex h-32 items-end gap-3 overflow-hidden rounded-t-xl bg-gradient-to-b ${ring} to-noir-deep px-4 sm:h-36`}>

      <div className="relative shrink-0 rounded-t-lg border-x-2 border-t-2 border-noir-border bg-[#141b26]">
        <PixelPortrait look={character.look} talking={talking} expression={expression} size={120} className="block" />
      </div>
      <div className="relative min-w-0 pb-3">
        <div className="font-display text-lg font-bold leading-tight text-slate-50">{character.name}</div>
        <div className="text-xs text-steel">{character.role}</div>
      </div>
    </div>
  );
}
