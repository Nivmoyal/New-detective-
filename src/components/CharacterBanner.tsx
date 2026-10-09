import type { CharacterRef } from '../types/investigation';
import CharacterPortrait from './three/CharacterPortrait';

interface Props {
  character: CharacterRef;
  talking?: boolean;
  tone?: 'police' | 'gold' | 'red';
}

/** Live 3D head-and-shoulders portrait of the person you are talking to. */
export default function CharacterBanner({ character, talking = true, tone = 'police' }: Props) {
  const ring = tone === 'gold' ? 'from-evidence/30' : tone === 'red' ? 'from-alert/30' : 'from-police/30';
  return (
    <div className={`relative h-40 overflow-hidden rounded-t-xl bg-gradient-to-b ${ring} to-noir-deep sm:h-48`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_65%)]" />
      <CharacterPortrait look={character.look} talking={talking} framing="head" className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir-panel via-noir-panel/80 to-transparent px-4 pb-2 pt-8">
        <div className="font-display text-lg font-bold leading-tight text-slate-50">{character.name}</div>
        <div className="text-xs text-steel">{character.role}</div>
      </div>
    </div>
  );
}
