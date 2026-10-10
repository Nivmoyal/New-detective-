// The detective's phone: the commander, the lab, the desk sergeant, witnesses
// who remembered something and the station's group chat. Messages follow
// what the detective does; none of them says where to go.
import { COMMANDER, DESK_SERGEANT, LAB_TECH } from '../data/characters';
import { genderize } from '../pixel/world/humor';
import { getCase, isCaseUnlocked, loadCases } from '../services/caseEngine';
import type { AddressForm } from '../types/investigation';

export interface PhoneMessage {
  id: string;
  from: string;
  text: string;
  at: number;
  read: boolean;
}

/** The parts of the game state the phone looks at. */
interface PhoneState {
  profile: { addressForm: AddressForm; reliability: number; solvedCases: string[] } | null;
  progress: Record<string, { collected: string[]; visitedHotspots: string[]; forced?: string[]; pressed?: string[]; warrantSuspectId: string | null; solved: boolean }>;
  messages?: PhoneMessage[];
}

type Action = { type: string; caseId?: string; hotspotId?: string; suspectId?: string };

const pickOne = (list: string[], k: number) => list[k % list.length];

const LAB = [
  'קיבלתי הודעה שאספת {item}. תביא{|י} לי את זה למעבדה ואני אגיד לך מי נגע בזה.',
  '{item} מחכה לי? אל תשאיר{|י} את זה בכיס. ראיות לא אוהבות כיסים.',
  'שמעתי על {item}. המיקרוסקופ שלי משתעמם. תביא{|י}.',
];
const FORCED = [
  'חתמתי על הצו. בפעם הבאה {תביא|תביאי} לי קודם ראיה, ואחר כך {תבקש|תבקשי}.',
  'הצו אצלך. אני מקווה {שאתה יודע|שאת יודעת} מה {אתה עושה|את עושה}, כי הפרקליטות תשאל אותי.',
];
const PRESSED = [
  'התקבלה תלונה בדלפק: חוקר{|ת} מהתחנה לחץ{|ה} על עד ברחוב. רשמתי. אני רק אומרת.',
  'עוד אזרח התקשר להתלונן שלחצו עליו. השמועה מתפשטת מהר יותר מהניידת.',
];
const DENIED = [
  'בלי ראיות אני לא חותמת. ותזכור{|י}: כל בקשה כזאת נרשמת אצלי.',
  'קראתי את הבקשה שלך לצו. {תחזור|תחזרי} כשיהיה לך משהו שמחזיק בבית משפט.',
];
const SOLVED = [
  'עבודה טובה. הפרקליטות קיבלה תיק סגור. ככה אני אוהבת.',
  'הודאה, ראיות, תיק נקי. אל {תתרגל|תתרגלי} למחמאות.',
  'שמעתי על ההודאה. השכונה תישן טוב יותר הלילה. אני פחות - יש עוד תיקים.',
];
const REMEMBERED = [
  'זה {who}, מהעדות. לא ישנתי בלילה - נזכרתי שמי שראיתי לא היסס לרגע. כאילו הכיר את המקום בעל פה.',
  'סליחה על עוד הודעה, זה {who}. עוד דבר: מי שראיתי הסתכל על השעון לפני שהלך. כאילו מיהר למקום אחר.',
  'זה {who}. אולי זה שטות, אבל מי שראיתי נראה רגוע מדי. מי שעושה דבר כזה בפעם הראשונה לא נראה ככה.',
];

/** The station's group chat: background noise, never about cases. */
export const GROUP_CHAT = [
  'מי לקח את המטען הלבן מהמשרד? זה לא מטען ציבורי, זה מטען של ניסים.',
  'תזכורת: מחר בשבע ריענון נהלי בטיחות. מי שלא מגיע - מתנדב לריענון הבא.',
  'נמצא במטבחון: יוגורט עם שם "מירב". מירב, הוא כבר לא יוגורט. הוא תרבות.',
  'המדפסת בקומה תקועה. שוב. מי שמצליח לתקן מקבל כבוד נצחי ושוקו.',
  'ליאת מבקשת להבהיר: הניידת היא לא מחסן במבה. כל השקיות שנמצאו הן "בהחזקה זמנית".',
  'מזל טוב לרס״ב שמעון: עוד 200 ימים לפנסיה. הוא כבר סופר אחורה בקול.',
  'מי שחנה על המדרכה מול התחנה - זה לא נראה טוב, חברים. אנחנו משטרה.',
  'יום הולדת לעדי מהדלפק! עוגה במטבחון בשתיים. מי שנוגע לפני - נחקר.',
  'המזגן בחדר החקירות שוב מפטפט. חשודים התלוננו שהוא מפריע להם לשתוק.',
  'מבצע בבורקס של יוסי: שלושה בעשרה. זה לא חדשות משטרה, אבל זה חשוב.',
  'נא לא להשאיר כוסות קפה במעבדה. ד״ר שטרן מבקשת. כלומר, דורשת.',
  'מישהו ראה את הסיכה של המפקדת? היא אומרת שזה לא דחוף. זה דחוף.',
];

let counter = 0;
export const newMessage = (from: string, text: string): PhoneMessage => ({ id: `m${Date.now()}-${counter++}`, from, text, at: Date.now(), read: false });
const msg = newMessage;

/** Messages that follow from one step of the game. */
export function messagesFor(prev: PhoneState, next: PhoneState, action: Action): PhoneMessage[] {
  if (!next.profile) return [];
  const g = (t: string) => genderize(t, next.profile!.addressForm);
  const n = (next.messages ?? []).length;
  const out: PhoneMessage[] = [];
  const caseId = action.caseId;
  const before = caseId ? prev.progress[caseId] : undefined;
  const after = caseId ? next.progress[caseId] : undefined;

  switch (action.type) {
    case 'VISIT_HOTSPOT': {
      if (!caseId || !after || after === before) break;
      const c = getCase(caseId);
      const fresh = after.collected.filter((id) => !(before?.collected ?? []).includes(id));
      const lab = fresh.map((id) => c.clues.find((x) => x.id === id)).find((x) => x?.requiresLab);
      if (lab) out.push(msg(LAB_TECH.name, g(pickOne(LAB, n)).replace('{item}', `"${lab.title}"`)));
      // An eyewitness who keeps thinking about it calls back, a while later.
      const w1 = c.hotspots.find((h) => h.id.endsWith('-h-w1'));
      if (c.generated && w1?.character && after.visitedHotspots.includes(w1.id) && after.visitedHotspots.length === 4)
        out.push(msg(w1.character.name, g(pickOne(REMEMBERED, n)).replace('{who}', w1.character.name.split(' ')[0])));
      break;
    }
    case 'FORCE_HOTSPOT':
      if (after?.forced?.length !== before?.forced?.length) out.push(msg(COMMANDER.name, g(pickOne(FORCED, n))));
      break;
    case 'PRESS_WITNESS':
      if (after?.pressed?.length !== before?.pressed?.length) out.push(msg(DESK_SERGEANT.name, g(pickOne(PRESSED, n))));
      break;
    case 'REQUEST_WARRANT':
      if (prev.profile && next.profile.reliability < prev.profile.reliability) out.push(msg(COMMANDER.name, g(pickOne(DENIED, n))));
      break;
    case 'END_INTERROGATION': {
      const solvedBefore = prev.profile?.solvedCases.length ?? 0;
      const solvedNow = next.profile.solvedCases.length;
      if (solvedNow > solvedBefore) {
        out.push(msg(COMMANDER.name, g(pickOne(SOLVED, n))));
        const landed = loadCases().filter((c) => isCaseUnlocked(c, solvedNow) && !isCaseUnlocked(c, solvedBefore));
        for (const c of landed) out.push(msg(DESK_SERGEANT.name, `תיק חדש הונח על השולחן שלך: "${c.title}".`));
      }
      break;
    }
  }
  return out;
}
