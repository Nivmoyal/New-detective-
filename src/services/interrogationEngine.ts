import type {
  CaseFile,
  InterrogationOption,
  InterrogationState,
  Specialization,
  Suspect,
  TacticId,
} from '../types/investigation';
import { getClue } from './caseEngine';

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

function pick(lines: string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length] ?? '';
}

export function startInterrogation(suspect: Suspect, specialization: Specialization): InterrogationState {
  const profile = suspect.interrogation;
  if (!profile) throw new Error(`Suspect ${suspect.id} cannot be interrogated`);
  const coopBonus = specialization === 'criminal' ? 10 : 0;
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

const DETECTIVE_LINES: Record<Exclude<TacticId, 'evidence'>, string[]> = {
  pressure: [
    'אנחנו יודעים הכל. השאלה היחידה היא אם תעזור לעצמך או לא.',
    'השותפים שלך כבר מדברים. אתה רוצה להיות האחרון שנשאר עם כל האשמה?',
    'תסתכל עליי. עוד שעה התיק עובר לפרקליטות, ואז כבר מאוחר מדי.',
  ],
  trust: [
    'אני לא פה כדי להרוס לך את החיים. אני פה כדי להבין מה קרה.',
    'קח רגע. רוצה קפה? אין לחץ, יש לנו זמן.',
    'אני רואה שאתה לא בן אדם רע. אנשים טובים נקלעים למצבים רעים.',
  ],
  confront: [
    'בוא נעשה סדר. הגרסה שלך לא מחזיקה מול אף אחת מהראיות שהצגתי.',
    'אתה אומר דבר אחד, המצלמות והמעבדה אומרות דבר אחר. מי משקר?',
  ],
};

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
    turn: state.turn + 1,
  };
  const seed = s.turn * 7 + s.progress * 3 + s.presented.length;
  const tensionScale = specialization === 'criminal' ? 0.85 : 1;
  const lines = profile.lines;

  switch (tactic) {
    case 'pressure': {
      s.log.push({ speaker: 'detective', text: pick(DETECTIVE_LINES.pressure, seed) });
      const before = s.tension;
      s.tension = clamp(s.tension + profile.pressureSensitivity * tensionScale);
      s.cooperation = clamp(s.cooperation - 6);
      if (s.presented.length >= 1 && before >= 40 && before <= 80 && !s.bonuses.includes(`pressure-${s.presented.length}`)) {
        s.progress += 1;
        s.bonuses.push(`pressure-${s.presented.length}`);
      }
      s.trustStreak = 0;
      s.log.push({ speaker: 'suspect', text: pick(lines.pressure, seed) });
      break;
    }
    case 'trust': {
      s.log.push({ speaker: 'detective', text: pick(DETECTIVE_LINES.trust, seed) });
      const gain = s.trustStreak >= 2 ? 4 : profile.trustAffinity;
      s.cooperation = clamp(s.cooperation + gain);
      s.tension = clamp(s.tension - 8);
      s.trustStreak += 1;
      if (s.cooperation >= 60 && !s.bonuses.includes('trust')) {
        s.progress += 1;
        s.bonuses.push('trust');
      }
      s.log.push({
        speaker: 'suspect',
        text: s.trustStreak >= 3 ? 'אתם חושבים שאם תהיו נחמדים אני אשכח איפה אני? נחמד, אבל לא.' : pick(lines.trust, seed),
      });
      break;
    }
    case 'evidence': {
      const clue = evidenceId ? getClue(caseFile, evidenceId) : undefined;
      if (!clue) return state;
      s.log.push({ speaker: 'detective', text: `מציג/ה ראיה: ${clue.title}.` });
      s.trustStreak = 0;
      if (s.presented.includes(clue.id)) {
        s.cooperation = clamp(s.cooperation - 4);
        s.log.push({ speaker: 'suspect', text: 'כבר ראיתי את זה. יש לכם משהו חדש?' });
        break;
      }
      s.presented.push(clue.id);
      if (clue.implicates.includes(suspect.id)) {
        const isKey = profile.keyEvidence.includes(clue.id);
        s.progress += isKey ? 2 : 1;
        s.tension = clamp(s.tension + (isKey ? 12 : 8) * tensionScale);
        s.cooperation = clamp(s.cooperation + 4);
        s.log.push({ speaker: 'suspect', text: pick(isKey ? lines.evidenceKey : lines.evidenceHit, seed) });
      } else {
        s.mistakes += 1;
        s.cooperation = clamp(s.cooperation - 12);
        s.tension = clamp(s.tension - 5);
        s.log.push({ speaker: 'suspect', text: pick(lines.evidenceMiss, seed) });
        s.log.push({ speaker: 'system', text: 'טעות טקטית: הראיה אינה קשורה לחשוד. הוא מרגיש בטוח יותר.' });
      }
      break;
    }
    case 'confront': {
      s.log.push({ speaker: 'detective', text: pick(DETECTIVE_LINES.confront, seed) });
      s.trustStreak = 0;
      const relevant = s.presented.filter((id) => getClue(caseFile, id)?.implicates.includes(suspect.id));
      if (relevant.length >= 2 && !s.bonuses.includes('confront')) {
        s.progress += 2;
        s.tension = clamp(s.tension + 15 * tensionScale);
        s.bonuses.push('confront');
        s.log.push({ speaker: 'suspect', text: pick(lines.confrontSuccess, seed) });
      } else if (relevant.length >= 2) {
        s.tension = clamp(s.tension + 10 * tensionScale);
        s.log.push({ speaker: 'suspect', text: 'כבר עברנו על זה. אני לא אחזור על עצמי.' });
      } else {
        s.mistakes += 1;
        s.tension = clamp(s.tension + 15 * tensionScale);
        s.cooperation = clamp(s.cooperation - 15);
        s.log.push({ speaker: 'suspect', text: pick(lines.confrontFail, seed) });
        s.log.push({ speaker: 'system', text: 'טעות טקטית: עימות בלי ראיות מבוססות מאפשר לחשוד להתבצר בגרסתו.' });
      }
      break;
    }
  }

  return resolveStatus(s, suspect, seed);
}

function resolveStatus(s: InterrogationState, suspect: Suspect, seed: number): InterrogationState {
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
    s.log.push({ speaker: 'suspect', text: pick(profile.lines.wavering, seed) });
  }
  if (s.turn >= MAX_TURNS) {
    s.status = 'silent';
    s.log.push({ speaker: 'system', text: 'זמן החקירה המותר הסתיים. החשוד הוחזר לתא בלי הודאה.' });
  }
  return s;
}
