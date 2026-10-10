import { useState } from 'react';
import { ChevronLeft, Shield, TrendingDown, TrendingUp } from 'lucide-react';
import type { Incident, IncidentChoice } from '../data/incidents';
import CharacterBanner from './CharacterBanner';
import { genderize } from '../pixel/world/humor';

interface Props {
  incident: Incident;
  addressForm: 'male' | 'female';
  onResolve: (choice: IncidentChoice) => void;
  onClose: () => void;
}

/** A street situation: hear people out, then decide how to handle it. */
export default function IncidentDialog({ incident, addressForm, onResolve, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<IncidentChoice | null>(null);
  const g = (t: string) => genderize(t, addressForm);
  const heard = step >= incident.intro.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center">
      <div className="panel max-h-[90vh] w-full max-w-lg animate-fadeUp overflow-y-auto shadow-2xl scrollbar-thin">
        <CharacterBanner character={incident.person} talking={!chosen} tone="gold" expression={chosen ? (chosen.reliability > 0 ? 'smile' : 'defiant') : 'tense'} />
        <div className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-evidence-light">
            <Shield className="h-3.5 w-3.5" />
            אירוע ברחוב · {incident.title}
          </div>

          {!chosen && (
            <>
              <div className="space-y-2">
                {incident.intro.slice(0, step + 1).map((line, i) => (
                  <p key={i} className="animate-fadeUp rounded-lg border border-noir-border bg-noir-deep/70 p-3 text-[15px] leading-relaxed text-slate-200">
                    {g(line)}
                  </p>
                ))}
              </div>
              {!heard ? (
                <div className="mt-3 flex justify-end">
                  <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
                    המשך
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-bold text-steel">מה עושים?</div>
                  {incident.choices.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => {
                        setChosen(c);
                        onResolve(c);
                      }}
                      className="w-full rounded-lg border border-noir-border bg-noir-deep p-3 text-right text-sm font-bold text-slate-100 transition hover:border-evidence-light"
                    >
                      {g(c.label)}
                    </button>
                  ))}
                  <button className="btn-ghost w-full" onClick={onClose}>
                    לא מתערבים הפעם
                  </button>
                </div>
              )}
            </>
          )}

          {chosen && (
            <div className="animate-fadeUp">
              <p className="rounded-lg border border-evidence/40 bg-evidence/10 p-3 text-[15px] leading-relaxed text-slate-100">{g(chosen.result)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                {chosen.reliability !== 0 && (
                  <span className={`label-tag ${chosen.reliability > 0 ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                    {chosen.reliability > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    אמינות {chosen.reliability > 0 ? '+' : ''}
                    {chosen.reliability}
                  </span>
                )}
                {chosen.intel > 0 && <span className="label-tag bg-police/20 text-police-light">מודיעין +{chosen.intel}</span>}
              </div>
              <button className="btn-gold mt-4 w-full" onClick={onClose}>
                חזרה לרחוב
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
