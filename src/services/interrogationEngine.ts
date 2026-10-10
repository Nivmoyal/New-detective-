import type {
  CaseFile,
  InterrogationOption,
  InterrogationState,
  Specialization,
  Suspect,
  TacticId,
} from '../types/investigation';
import { getClue } from './caseEngine';
import { DETECTIVE, SUSPECT, type Mood } from './interrogationLines';

export const MAX_TURNS = 12;
export const MAX_MISTAKES = 3;
const MIN_COOPERATION_TO_CONFESS = 25;

export const TACTICS: InterrogationOption[] = [
  {
    id: 'pressure',
    label: 'לחץ פסיכולוגי',
    description: 'מעלה את מד הלחץ. אפקטיבי אחרי שהוצגו ראיות, מסוכן אם החשוד כבר על הקצה.',
  },
  {
    id: 'evidence',
    label: 'הצגת ראיה מפריכה',
    description: 'הצגת ראיה מהתיק. ראיה רלוונטית סודקת את הגרסה, ראיה לא קשורה מחזקת את החשוד.',
  },
  {
    id: 'trust',
    label: 'בניית אמון',
    description: 'מוריד לחץ ומעלה שיתוף פעולה. שימוש חוזר ברצף מאבד מהאפקטיביות.',
  },
  {
    id: 'confront',
    label: 'יצירת עימות',
    description: 'עימות ישיר מול הסתירות. דורש לפחות שתי ראיות שהוצגו, אחרת זו טעות.',
  },
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function startInterrogation(suspect: Suspect, specialization: Specialization, reliability = 60): InterrogationState {
  const profile = suspect.interrogation;
  if (!profile) throw new Error(`Suspect ${suspect.id} cannot be interrogated`);
  // A detective's reputation walks into the room first: a trusted one gets
  // more cooperation, one known for cutting corners gets less.
  const coopBonus = (specialization === 'criminal' ? 10 : 0) + Math.round((reliability - 60) / 4);
  return {
    suspectId: suspect.id,
    tension: profile.startTension,
    cooperation: clamp(profile.startCooperation + coopBonus),
    progress: 0,
    presented: [],
    mistakes: 0,
    turn: 0,
    trustStreak: 0,
    bonuses: [],
    said: [profile.openingStatement],
    status: 'active',
    log: [
      {
        speaker: 'system',
        text: `החקירה באזהרה נפתחה. החשוד ${suspect.name} הוזהר כי אינו חייב לומר דבר, וכי כל מה שיאמר עשוי לשמש ראיה נגדו.`,
      },
      { speaker: 'suspect', text: profile.openingStatement },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Choosing what is said                                               */
/* ------------------------------------------------------------------ */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gendered(text: string, female: boolean): string {
  return text.replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m: string, f: string) => (female ? f : m));
}

interface Speech {
  s: InterrogationState;
  female: boolean;
  seed: string;
}

/**
 * Pick a line that was not said yet: the first pool with something unused wins,
 * so the suspect's own lines come before the general ones.
 */
function say(sp: Speech, pools: (string[] | undefined)[], vars: Record<string, string> = {}): string {
  const fill = (t: string) => gendered(t.replace(/\{clue\}|\{other\}|\{a\}|\{b\}/g, (k) => vars[k.slice(1, -1)] ?? ''), sp.female);
  const said = sp.s.said ?? [];
  for (const pool of pools) {
    if (!pool?.length) continue;
    const fresh = pool.map(fill).filter((l) => !said.includes(l));
    if (!fresh.length) continue;
    const line = fresh[hash(sp.seed + said.length) % fresh.length];
    sp.s.said = [...said, line];
    return line;
  }
  // Everything was said already: fall back to the least recent line of the last pool.
  const last = pools.filter((p) => p?.length).pop() ?? [''];
  return fill(last[hash(sp.seed) % last.length]);
}

function moodOf(tension: number): Mood {
  return tension < 40 ? 'calm' : tension < 70 ? 'nervous' : 'cracking';
}

/** Apply an interrogation tactic and return the next state. Pure function. */
export function applyTactic(
  state: InterrogationState,
  caseFile: CaseFile,
  suspect: Suspect,
  tactic: TacticId,
  specialization: Specialization,
  evidenceId?: string,
): InterrogationState {
  const profile = suspect.interrogation;
  if (!profile || state.status !== 'active') return state;

  const s: InterrogationState = {
    ...state,
    presented: [...state.presented],
    bonuses: [...state.bonuses],
    log: [...state.log],
    said: [...(state.said ?? [])],
    turn: state.turn + 1,
  };
  const repeated = state.lastTactic === tactic;
  s.tacticStreak = repeated ? (state.tacticStreak ?? 1) + 1 : 1;
  s.lastTactic = tactic;
  const seed = s.turn * 7 + s.progress * 3 + s.presented.length;
  const sp: Speech = { s, female: suspect.look?.body === 'female', seed: `${suspect.id}:${s.turn}:${tactic}:${evidenceId ?? ''}` };
  const tensionScale = specialization === 'criminal' ? 0.85 : 1;
  const lines = profile.lines;
  const mood = moodOf(s.tension);
  const nameOf = (id: string) => caseFile.suspects.find((x) => x.id === id)?.name ?? '';
  const lastClue = [...s.presented].reverse().map((id) => getClue(caseFile, id)).find((c) => c?.implicates.includes(suspect.id));

  switch (tactic) {
    case 'pressure': {
      s.log.push({
        speaker: 'detective',
        text: say(sp, [repeated ? DETECTIVE.pressureRepeat : undefined, lastClue ? DETECTIVE.pressureEvidence : DETECTIVE.pressureBluff, DETECTIVE.pressureBluff], { clue: lastClue?.title ?? '' }),
      });
      const before = s.tension;
      // Shouting again and again wears thin.
      const fatigue = repeated ? 0.6 : 1;
      s.tension = clamp(s.tension + profile.pressureSensitivity * tensionScale * fatigue);
      s.cooperation = clamp(s.cooperation - (repeated ? 9 : 6));
      if (s.presented.length >= 1 && before >= 40 && before <= 80 && !s.bonuses.includes(`pressure-${s.presented.length}`)) {
        s.progress += 1;
        s.bonuses.push(`pressure-${s.presented.length}`);
      }
      s.trustStreak = 0;
      const moodNow = moodOf(s.tension);
      s.log.push({
        speaker: 'suspect',
        text: say(sp, [repeated ? SUSPECT.pressure.repeat : undefined, moodNow === 'calm' ? lines.pressure : undefined, SUSPECT.pressure[moodNow], lines.pressure]),
      });
      break;
    }
    case 'trust': {
      s.log.push({ speaker: 'detective', text: say(sp, [DETECTIVE.trust]) });
      const gain = s.trustStreak >= 2 ? 4 : profile.trustAffinity;
      s.cooperation = clamp(s.cooperation + gain);
      s.tension = clamp(s.tension - 8);
      s.trustStreak += 1;
      if (s.cooperation >= 60 && !s.bonuses.includes('trust')) {
        s.progress += 1;
        s.bonuses.push('trust');
      }
      const stance = s.cooperation < 30 ? 'hostile' : s.cooperation < 60 ? 'warming' : 'open';
      s.log.push({
        speaker: 'suspect',
        text: say(sp, [s.trustStreak >= 3 ? SUSPECT.trust.repeat : undefined, stance !== 'hostile' ? lines.trust : undefined, SUSPECT.trust[stance], lines.trust]),
      });
      break;
    }
    case 'evidence': {
      const clue = evidenceId ? getClue(caseFile, evidenceId) : undefined;
      if (!clue) return state;
      s.log.push({ speaker: 'detective', text: say(sp, [DETECTIVE.evidenceIntro], { clue: clue.title }) });
      s.trustStreak = 0;
      if (s.presented.includes(clue.id)) {
        s.cooperation = clamp(s.cooperation - 4);
        s.log.push({ speaker: 'suspect', text: say(sp, [SUSPECT.evidenceRepeat]) });
        break;
      }
      s.presented.push(clue.id);
      const vars = { clue: clue.title };
      if (clue.implicates.includes(suspect.id)) {
        const isKey = profile.keyEvidence.includes(clue.id);
        s.progress += isKey ? 2 : 1;
        s.tension = clamp(s.tension + (isKey ? 12 : 8) * tensionScale);
        s.cooperation = clamp(s.cooperation + 4);
        const moodNow = moodOf(s.tension);
        const sourcePool = SUSPECT.evidenceBySource[clue.source];
        s.log.push({
          speaker: 'suspect',
          text: isKey
            ? say(sp, [lines.evidenceKey, SUSPECT.keyShaken[moodNow]], vars)
            : say(sp, [mood === 'calm' ? sourcePool : lines.evidenceHit, lines.evidenceHit, sourcePool], vars),
        });
      } else if (clue.clears.includes(suspect.id)) {
        // Showing the suspect their own alibi: a gift.
        s.mistakes += 1;
        s.tension = clamp(s.tension - 15);
        s.cooperation = clamp(s.cooperation - 5);
        s.log.push({ speaker: 'suspect', text: say(sp, [SUSPECT.evidenceClearsSelf]) });
        s.log.push({ speaker: 'system', text: 'טעות טקטית: הצגת לחשוד ראיה שמחזקת את הגרסה שלו.' });
      } else if (clue.implicates.length) {
        // Evidence against someone else: the suspect grabs the way out.
        const other = nameOf(clue.implicates[0]);
        s.tension = clamp(s.tension - 10);
        s.cooperation = clamp(s.cooperation - 4);
        s.log.push({ speaker: 'suspect', text: say(sp, [SUSPECT.evidenceOther], { other }) });
        s.log.push({ speaker: 'system', text: `החשוד נאחז בראיה נגד ${other} ומרגיש בטוח יותר.` });
      } else if (clue.clears.length) {
        // Another suspect is out of the picture: the room gets smaller.
        const other = nameOf(clue.clears[0]);
        s.tension = clamp(s.tension + 7 * tensionScale);
        if (!s.bonuses.includes('narrow')) {
          s.progress += 1;
          s.bonuses.push('narrow');
        }
        s.log.push({ speaker: 'suspect', text: say(sp, [SUSPECT.evidenceClearsOther], { other }) });
        s.log.push({ speaker: 'system', text: `החשוד מבין ש${other} כבר לא בתמונה. נשארו פחות מקומות להסתתר.` });
      } else {
        s.mistakes += 1;
        s.cooperation = clamp(s.cooperation - 12);
        s.tension = clamp(s.tension - 5);
        s.log.push({ speaker: 'suspect', text: say(sp, [lines.evidenceMiss, SUSPECT.evidenceMiss], vars) });
        s.log.push({ speaker: 'system', text: 'טעות טקטית: הראיה אינה קשורה לחשוד. הוא מרגיש בטוח יותר.' });
      }
      break;
    }
    case 'confront': {
      const relevant = s.presented.map((id) => getClue(caseFile, id)).filter((c) => c?.implicates.includes(suspect.id));
      s.log.push({
        speaker: 'detective',
        text:
          relevant.length >= 2
            ? say(sp, [DETECTIVE.confront], { a: relevant[relevant.length - 2]!.title, b: relevant[relevant.length - 1]!.title })
            : say(sp, [DETECTIVE.pressureBluff]),
      });
      s.trustStreak = 0;
      if (relevant.length >= 2 && !s.bonuses.includes('confront')) {
        s.progress += 2;
        s.tension = clamp(s.tension + 15 * tensionScale);
        s.bonuses.push('confront');
        s.log.push({ speaker: 'suspect', text: say(sp, [lines.confrontSuccess, SUSPECT.keyShaken[moodOf(s.tension)]]) });
      } else if (relevant.length >= 2) {
        s.tension = clamp(s.tension + 10 * tensionScale);
        s.log.push({ speaker: 'suspect', text: say(sp, [SUSPECT.confrontRepeat]) });
      } else {
        s.mistakes += 1;
        s.tension = clamp(s.tension + 15 * tensionScale);
        s.cooperation = clamp(s.cooperation - 15);
        s.log.push({ speaker: 'suspect', text: say(sp, [lines.confrontFail, SUSPECT.confrontFail]) });
        s.log.push({ speaker: 'system', text: 'טעות טקטית: עימות בלי ראיות מבוססות מאפשר לחשוד להתבצר בגרסתו.' });
      }
      break;
    }
  }

  return resolveStatus(s, suspect, seed, sp);
}

function resolveStatus(s: InterrogationState, suspect: Suspect, seed: number, sp: Speech): InterrogationState {
  void seed;
  const profile = suspect.interrogation!;
  if (s.tension >= 100) {
    s.status = 'lawyer';
    s.log.push({ speaker: 'suspect', text: profile.lawyer });
    s.log.push({ speaker: 'system', text: 'החשוד ביקש להיוועץ בעורך דין. החקירה הופסקה.' });
    return s;
  }
  if (s.cooperation <= 0 || s.mistakes >= MAX_MISTAKES) {
    s.status = 'silent';
    s.log.push({ speaker: 'suspect', text: profile.silence });
    s.log.push({ speaker: 'system', text: 'החשוד מימש את זכות השתיקה. החקירה הופסקה.' });
    return s;
  }
  if (s.progress >= profile.breakThreshold) {
    if (s.cooperation >= MIN_COOPERATION_TO_CONFESS) {
      s.status = 'confessed';
      profile.confession.forEach((text) => s.log.push({ speaker: 'suspect', text }));
      s.log.push({ speaker: 'system', text: 'הודאה מלאה נגבתה ותועדה בווידאו. התיק מוכן להגשת כתב אישום.' });
      return s;
    }
    s.log.push({ speaker: 'system', text: 'החשוד על סף שבירה, אבל לא בוטח בכם מספיק כדי לדבר. נסו לבנות אמון.' });
  } else if (s.progress >= profile.breakThreshold - 2) {
    s.log.push({ speaker: 'suspect', text: say(sp, [profile.lines.wavering, SUSPECT.wavering]) });
  }
  if (s.turn >= MAX_TURNS) {
    s.status = 'silent';
    s.log.push({ speaker: 'system', text: 'זמן החקירה המותר הסתיים. החשוד הוחזר לתא בלי הודאה.' });
  }
  return s;
}
