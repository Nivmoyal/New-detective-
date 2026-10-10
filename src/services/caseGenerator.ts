// Endless cases: after the story cases, new files keep landing on the desk.
// Every generated case is built from a crime template, a place on one of the
// maps, three freshly generated suspects and the witnesses around them. The
// structure always holds together: the culprit is tied by four pieces of
// evidence (a lab item and a camera are the key ones), each innocent suspect
// draws one or two false leads and has an alibi that clears them.
import { citySpots, placeName, prepareCity, type Spot } from '../data/citySpots';
import { MAPS, SCENE_MAP_IDS } from '../data/maps';
import type { CaseFile, CharacterLook, CharacterRef, Clue, MapHotspot, Suspect } from '../types/investigation';

// The open places and extra residents are part of the world from the start.
prepareCity();

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length)];
const shuffle = <T,>(r: Rand, list: readonly T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const fill = (t: string, vars: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
/** {m|f} markers follow the gender of the person the sentence is about. */
const g = (t: string, female: boolean) => t.replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m: string, f: string) => (female ? f : m));

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const MALE = ['עומר', 'אלון', 'יוני', 'שי', 'ניר', 'רז', 'גיל', 'עידו', 'מאור', 'אליעזר', 'סהר', 'אביב', 'דור', 'נתנאל', 'ששון', 'מוטי', 'ג׳קי', 'אריאל', 'בן', 'חיים', 'ויקטור', 'אדהם', 'ברוך', 'טל'];
const FEMALE = ['נוי', 'מיכל', 'שירה', 'רוני', 'אורטל', 'סיון', 'הדס', 'לימור', 'אסנת', 'דנה', 'מאיה', 'רחל', 'יעל', 'ענבל', 'לילך', 'סתיו', 'זהבה', 'אנה', 'מרים', 'טליה', 'גלית', 'עדן'];
const SURNAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אוחיון', 'אברהם', 'דהן', 'אזולאי', 'מלכה', 'פרידמן', 'שפירא', 'גבאי', 'חדד', 'סויסה', 'רוזן', 'קליין', 'אלמוג', 'בן דוד', 'נחום', 'שלום', 'וקנין', 'טל', 'יוסף'];

const SKINS = ['#f3d2b3', '#e5b48f', '#c98f66', '#9c6644', '#6b4430'];
const HAIRS = ['#16120f', '#3b2618', '#6b4423', '#a8743f', '#7a2e1a', '#bdb6ad'];

/** Clothing colors with names, so witnesses can describe what they saw. */
const COLORS: { hex: string; m: string; f: string }[] = [
  { hex: '#b91c1c', m: 'אדום', f: 'אדומה' },
  { hex: '#1e3a8a', m: 'כחול', f: 'כחולה' },
  { hex: '#15803d', m: 'ירוק', f: 'ירוקה' },
  { hex: '#111318', m: 'שחור', f: 'שחורה' },
  { hex: '#e7e5e4', m: 'לבן', f: 'לבנה' },
  { hex: '#ca8a04', m: 'צהוב', f: 'צהובה' },
  { hex: '#7c2d12', m: 'חום', f: 'חומה' },
  { hex: '#6b7280', m: 'אפור', f: 'אפורה' },
  { hex: '#7e22ce', m: 'סגול', f: 'סגולה' },
];

const GARMENTS: Record<string, { name: string; female: boolean }> = {
  hoodie: { name: 'קפוצ׳ון', female: false },
  leather: { name: 'מעיל עור', female: false },
  tshirt: { name: 'חולצת טריקו', female: true },
  blazer: { name: 'ז׳קט', female: false },
  suit: { name: 'חליפה', female: true },
  vest: { name: 'אפוד', female: false },
  apron: { name: 'סינר', female: false },
};

interface Person {
  name: string;
  female: boolean;
  look: CharacterLook;
  /** "קפוצ׳ון אדום" - what a witness would remember. */
  clothes: string;
  /** Grammatical gender of that garment. */
  clothesFemale: boolean;
}

function person(r: Rand, used: Set<string>, outfits: CharacterLook['outfit'][], female = r() < 0.4): Person {
  // Nobody in one case shares a first name or a family name with anyone else.
  let first = pick(r, female ? FEMALE : MALE);
  for (let i = 0; i < 30 && used.has(first); i++) first = pick(r, female ? FEMALE : MALE);
  let last = pick(r, SURNAMES);
  for (let i = 0; i < 30 && (used.has(last) || last.includes(first)); i++) last = pick(r, SURNAMES);
  used.add(first);
  used.add(last);
  const name = `${first} ${last}`;
  const outfit = pick(r, outfits);
  const color = pick(r, COLORS);
  const garment = GARMENTS[outfit] ?? GARMENTS.tshirt;
  const look: CharacterLook = {
    body: female ? 'female' : 'male',
    skin: pick(r, SKINS),
    hairStyle: pick(r, female ? (['long', 'ponytail', 'bun', 'curly'] as const) : (['short', 'buzz', 'curly', 'bald', 'short'] as const)),
    hairColor: pick(r, HAIRS),
    outfit,
    topColor: color.hex,
    pantsColor: pick(r, ['#17191d', '#2d3440', '#3b3a36', '#24324a']),
    beard: !female && r() < 0.35,
    glasses: r() < 0.25,
  };
  return { name, female, look, clothes: `${garment.name} ${garment.female ? color.f : color.m}`, clothesFemale: garment.female };
}

const ref = (p: Person, role: string): CharacterRef => ({ name: p.name, role, look: p.look });

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

interface Site {
  mapId: string;
  place: string;
  scene: string;
  witness1: string;
  witness2: string;
  camera: string;
  cameraOwner: string;
  alibi: string;
}

/** Spots on the maps reserved for generated cases (anchors are defined in the map files). */
export const SITES: Site[] = [
  { mapId: 'levinsky', place: 'חניון ברחוב לוינסקי', scene: 'gen-lev-a-scene', witness1: 'gen-lev-a-w1', witness2: 'gen-lev-a-w2', camera: 'gen-lev-a-cam', cameraOwner: 'בעל{|ת} המכולת ממול', alibi: 'gen-lev-a-alibi' },
  { mapId: 'oldCbs', place: 'אולם הרציפים בתחנה המרכזית הישנה', scene: 'gen-cbs-a-scene', witness1: 'gen-cbs-a-w1', witness2: 'gen-cbs-a-w2', camera: 'gen-cbs-a-cam', cameraOwner: 'מאבטח{|ת} המתחם', alibi: 'gen-cbs-a-alibi' },
  { mapId: 'florentin', place: 'כיכר פלורנטין', scene: 'gen-fl-a-scene', witness1: 'gen-fl-a-w1', witness2: 'gen-fl-a-w2', camera: 'gen-fl-a-cam', cameraOwner: 'בעל{|ת} הקיוסק בכיכר', alibi: 'gen-fl-a-alibi' },
  { mapId: 'shapira', place: 'שביל המחסנים בשפירא', scene: 'gen-sh-a-scene', witness1: 'gen-sh-a-w1', witness2: 'gen-sh-a-w2', camera: 'gen-sh-a-cam', cameraOwner: 'בעל{|ת} המוסך הסמוך', alibi: 'gen-sh-a-alibi' },
  { mapId: 'neveShaanan', place: 'החניון הדרומי בנווה שאנן', scene: 'gen-ns-a-scene', witness1: 'gen-ns-a-w1', witness2: 'gen-ns-a-w2', camera: 'gen-ns-a-cam', cameraOwner: 'בעל{|ת} המאפייה ממול', alibi: 'gen-ns-a-alibi' },
  { mapId: 'levinsky', place: 'הסמטה האחורית של השוק', scene: 'gen-lev-b-scene', witness1: 'gen-lev-b-w1', witness2: 'gen-lev-b-w2', camera: 'gen-lev-b-cam', cameraOwner: 'מוכר{|ת} הפיצוחים', alibi: 'gen-lev-b-alibi' },
  { mapId: 'oldCbs', place: 'הרציפים התחתונים בתחנה הישנה', scene: 'gen-cbs-b-scene', witness1: 'gen-cbs-b-w1', witness2: 'gen-cbs-b-w2', camera: 'gen-cbs-b-cam', cameraOwner: 'שומר{|ת} החניון', alibi: 'gen-cbs-b-alibi' },
  { mapId: 'florentin', place: 'החצר של הנגרייה בפלורנטין', scene: 'gen-fl-b-scene', witness1: 'gen-fl-b-w1', witness2: 'gen-fl-b-w2', camera: 'gen-fl-b-cam', cameraOwner: 'בעל{|ת} הבר ברחוב וושינגטון', alibi: 'gen-fl-b-alibi' },
  { mapId: 'shapira', place: 'הגינה הציבורית בשפירא', scene: 'gen-sh-b-scene', witness1: 'gen-sh-b-w1', witness2: 'gen-sh-b-w2', camera: 'gen-sh-b-cam', cameraOwner: 'הגבאי של בית הכנסת', alibi: 'gen-sh-b-alibi' },
  { mapId: 'neveShaanan', place: 'הגינה בנווה שאנן', scene: 'gen-ns-b-scene', witness1: 'gen-ns-b-w1', witness2: 'gen-ns-b-w2', camera: 'gen-ns-b-cam', cameraOwner: 'מוכר{|ת} הבגדים במדרחוב', alibi: 'gen-ns-b-alibi' },
];

/* ------------------------------------------------------------------ */
/* Crime templates                                                     */
/* ------------------------------------------------------------------ */

interface Role {
  occupation: string;
  outfits: CharacterLook['outfit'][];
  /** What makes them look guilty. */
  motive: string;
  /** What clears them when they are innocent (where they really were). */
  alibi: string;
  alibiSource: 'document' | 'testimony';
  /** What they say when they finally break. */
  confession: string[];
  opening: string;
  /** Age range, when the role implies one. */
  age?: [number, number];
}

interface Template {
  id: string;
  crimeType: string;
  title: string;
  summary: string;
  item: string;
  itemFound: string;
  labResult: string;
  sawText: string;
  cameraText: string;
  /** A rumor that makes an innocent suspect look bad ({name} is that suspect). */
  rumor: string;
  /** When it happened, as people say it: "באותו לילה". */
  when: string;
  roles: [Role, Role, Role];
}

const TEMPLATES: Template[] = [
  {
    id: 'burglary',
    crimeType: 'פריצה',
    title: 'פריצה לעסק של {victim}',
    summary: 'העסק של {victim}, ליד {place}, נפרץ בלילה. נגנבו מזומנים מהקופה וציוד בשווי עשרות אלפי שקלים. אין סימני פריצה גסה - מי שנכנס ידע מה הוא עושה.',
    item: 'מברג שבור',
    itemFound: 'ליד הדלת נמצא מברג שבור, עם שאריות צבע מהמשקוף. נארז למז״פ.',
    labResult: 'טביעת אצבע חלקית על הידית של המברג: {culprit}.',
    sawText: 'בסביבות שתיים בלילה ראיתי {מישהו|מישהי} ב{clothes} {יוצא|יוצאת} משם עם תיק גדול. {הוא|היא} הלך{|ה} מהר, בלי להסתכל לצדדים.',
    cameraText: 'המצלמה קלטה ב-02:07 דמות ב{clothes} נכנסת מהדלת האחורית. בפריים אחד הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} באזור יום לפני, ושאל{|ה} מתי {victim} {v:סוגר|סוגרת} את העסק בלילה.',
    when: 'באותו לילה',
    roles: [
      { occupation: 'עובד{|ת} לשעבר שפוטר{|ה} לפני חודש', outfits: ['hoodie', 'tshirt'], motive: '{name} פוטר{|ה} לפני חודש וצעק{|ה} מול כולם ש"עוד ישלמו על זה". {הוא|היא} גם מכיר{|ה} את הקוד של האזעקה.', alibi: 'רישומי בית החולים מראים ש{name} {היה|הייתה} במשמרת לילה כמאבטח{|ת} באיכילוב, מעשר בלילה ועד שש בבוקר.', alibiSource: 'document', confession: ['פיטרו אותי בלי שקל פיצויים. אחרי שש שנים.', 'ידעתי את הקוד, ידעתי איפה הקופה. חשבתי שזה רק מה שמגיע לי.'], opening: 'פוטרתי, נכון. אבל אני לא גנב{|ת}. תשאלו כל מי שעבד איתי.' },
      { occupation: 'שכ{ן|נה} מהבניין', outfits: ['tshirt', 'vest'], motive: 'השכנים מספרים ש{name} מסוכסך{|ת} עם {victim} כבר שנה, על רעש ועל חניה. לפני שבוע היה ביניהם ויכוח צעקות.', alibi: 'בן הזוג של {name} מראה תמונות וכרטיסים מהופעה בקיסריה באותו לילה, עם חותמת זמן עד שלוש לפנות בוקר.', alibiSource: 'testimony', confession: ['{v:הוא הרס|היא הרסה} לי את השנה עם הרעש והטענות. רציתי שגם {v:הוא ירגיש|היא תרגיש}.', 'לקחתי את הכסף כדי שזה ייראה כמו פריצה. לא חשבתי שזה יגיע לכאן.'], opening: 'אנחנו לא חברים, זה נכון. אבל מכאן ועד פריצה?' },
      { occupation: 'פורץ{|ת} עם עבר פלילי', outfits: ['leather', 'hoodie'], motive: '{name} השתחרר{|ה} מהכלא לפני שלושה חודשים, אחרי ריצוי עונש על סדרת פריצות לעסקים באזור.', alibi: 'קצין המבחן מאשר: {name} חובש{|ת} איזוק אלקטרוני, והמכשיר מראה שלא יצא{|ה} מהבית כל הלילה.', alibiSource: 'document', confession: ['יצאתי מהכלא ולא היה לי כלום. אף אחד לא נותן עבודה למי שישב.', 'זה העסק היחיד שהכרתי. חשבתי שהפעם אף אחד לא יקשר אותי.'], opening: 'בכל פעם שמשהו קורה בשכונה - באים אליי. כבר שילמתי על מה שעשיתי.' },
    ],
  },
  {
    id: 'robbery',
    crimeType: 'שוד',
    title: 'שוד ברחוב: {victim} נשדד{|ה} ליד {place}',
    summary: '{victim} נשדד{|ה} בשעות הערב ליד {place}. השודד דחף, חטף תיק עם מזומנים וטלפון, וברח רגלית. {victim} נחבל{|ה} קל ופונה לטיפול.',
    item: 'תיק ריק שנזרק',
    itemFound: 'בפח לא רחוק נמצא התיק של {victim}, ריק. נארז למז״פ לבדיקת טביעות.',
    labResult: 'על האבזם של התיק נמצאה טביעת אצבע ברורה: {culprit}.',
    sawText: 'ראיתי {מישהו|מישהי} ב{clothes} {רץ|רצה} משם, ממש אחרי הצעקה. {הוא|היא} כמעט הפיל{|ה} אותי.',
    cameraText: 'במצלמה: 20:41, דמות ב{clothes} רצה עם תיק ביד. שלושים שניות אחר כך היא עוברת מול המצלמה שוב, בלי התיק. הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} באותו רחוב שעה לפני השוד, עומד{|ת} בפינה בלי לעשות כלום.',
    when: 'באותו ערב',
    roles: [
      { occupation: 'נער{|ה} מהשכונה', age: [16, 19], outfits: ['hoodie', 'tshirt'], motive: 'בשכונה מספרים ש{name} מסתובב{|ת} עם חבורה שחוטפת טלפונים ברחובות האלה.', alibi: 'המאמן של {name} מאשר: באותה שעה היה אימון כדורגל במגרש, עם עשרים ילדים ותמונות.', alibiSource: 'testimony', confession: ['חייבים כסף לאנשים לא טובים. אמרו לי להביא עד סוף השבוע.', 'לא רציתי לדחוף. {v:הוא פשוט לא עזב|היא פשוט לא עזבה} את התיק.'], opening: 'כל פעם שמשהו קורה ברחוב - הילדים מהשכונה אשמים. נמאס.' },
      { occupation: 'שליח{|ה}', outfits: ['vest', 'hoodie'], motive: '{name} {נראה|נראתה} באזור כמה פעמים באותו ערב, ולפי השכנים "{מסתכל|מסתכלת} על אנשים יותר מאשר על משלוחים".', alibi: 'האפליקציה של חברת המשלוחים מראה ש{name} {היה|הייתה} באמצע משלוח בבת ים בשעת השוד.', alibiSource: 'document', confession: ['האפליקציה הורידה לי את המשכורת בחצי. היו לי חובות.', 'ראיתי את התיק פתוח, ראיתי את המזומנים. זה לקח שנייה.'], opening: 'אני עובד{|ת} כל היום על קורקינט. אין לי זמן לשדוד אף אחד.' },
      { occupation: 'מכר{|ה} של הקורבן שחייב{|ת} כסף', outfits: ['leather', 'blazer'], motive: '{name} חייב{|ת} ל{victim} שמונת אלפים שקל, והחוב תפח לוויכוחים בטלפון.', alibi: 'הבוס של {name} מראה את דו״ח הנוכחות: {name} עבד{|ה} במשמרת ערב במסעדה ברמת גן עד אחת עשרה.', alibiSource: 'document', confession: ['{v:הוא לא הפסיק|היא לא הפסיקה} לדרוש את הכסף. {v:איים|איימה} להגיד לכולם.', 'לקחתי את התיק כי ידעתי שהכסף בפנים. רציתי שזה ייגמר.'], opening: 'אני חייב{|ת} {v:לו|לה} כסף, זה נכון. מכאן ועד לשדוד? אתם רציניים?' },
    ],
  },
  {
    id: 'assault',
    crimeType: 'תקיפה',
    title: 'תקיפה ליד {place}',
    summary: '{victim} הותקף{|ה} בלילה ליד {place} ואושפז{|ה} עם חבלות. {הוא|היא} לא {ראה|ראתה} את פני התוקף, רק שמע{|ה} קול מוכר.',
    item: 'בקבוק שבור',
    itemFound: 'במקום נמצא בקבוק שבור עם כתמי דם. נארז למז״פ.',
    labResult: 'על צוואר הבקבוק נמצא DNA ממגע: {culprit}. הדם על השברים - של הקורבן.',
    sawText: 'שמעתי צעקות וראיתי {מישהו|מישהי} ב{clothes} {בורח|בורחת} לכיוון הרחוב. {הוא|היא} החזיק{|ה} משהו ביד.',
    cameraText: 'המצלמה: 00:52, ויכוח קולני בין {victim} לדמות ב{clothes}. 00:54, הדמות בורחת. בפריים האחרון הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} באותו ערב ליד הבר, ושאל{|ה} אם {victim} כבר {v:יצא|יצאה}.',
    when: 'באותו לילה',
    roles: [
      { occupation: 'מאבטח{|ת} במועדון הסמוך', outfits: ['tshirt', 'leather'], motive: '{name} {סילק|סילקה} את {victim} מהמועדון באותו ערב, ולפי עדים {איים|איימה} ש"זה לא נגמר".', alibi: 'מצלמות הכניסה של המועדון מראות את {name} בעמדה ברציפות עד ארבע לפנות בוקר.', alibiSource: 'document', confession: ['{v:הוא קילל|היא קיללה} אותי מול כולם. {v:ירק|ירקה} עליי.', 'הלכתי {v:אחריו|אחריה} רק לדבר. ואז הכל התפוצץ.'], opening: 'אני מאבטח{|ת}. אני מפריד{|ה} בין אנשים, לא מרביץ{|ה} להם.' },
      { occupation: '{בן זוג|בת זוג} לשעבר של {victim}', outfits: ['blazer', 'tshirt'], motive: 'החברים של {victim} מספרים שהפרידה מ{name} הייתה קשה, ושהיו הודעות מאיימות.', alibi: 'כרטיסי טיסה וחותמות דרכון: {name} חזר{|ה} מאתונה רק למחרת בצהריים.', alibiSource: 'document', confession: ['ראיתי {v:אותו|אותה} עם מישהו חדש. משהו פשוט נשבר בי.', 'לא תכננתי. אני נשבע{|ת} שלא תכננתי.'], opening: 'נפרדנו. זה כואב, אבל אני לא אלים{|ה}.' },
      { occupation: 'לקוח{|ה} קבוע{|ה} בבר', outfits: ['hoodie', 'leather'], motive: 'הברמנית מספרת ש{name} התווכח{|ה} עם {victim} על חוב מהימורים באותו ערב.', alibi: 'נהג מונית מאשר: הוא אסף את {name} מהבר לפני חצות {והוריד אותו|והוריד אותה} בהרצליה, עם קבלה ושעה.', alibiSource: 'testimony', confession: ['{v:הוא חייב|היא חייבת} לי כסף כבר שנה. {v:צחק|צחקה} עליי מול כולם.', 'שתיתי יותר מדי. זה לא תירוץ, אני יודע{|ת}.'], opening: 'שתינו, התווכחנו, הלכתי הביתה. זהו.' },
    ],
  },
  {
    id: 'carTheft',
    crimeType: 'גניבת רכב',
    title: 'גניבת הרכב של {victim}',
    summary: 'הרכב של {victim} נגנב מ{place} באמצע הלילה. בלי שבירת חלון, בלי אזעקה. מישהו ידע בדיוק איך לנטרל את המערכת.',
    item: 'מכשיר פריצה אלקטרוני',
    itemFound: 'בשיחים ליד מקום החניה נמצא מכשיר אלקטרוני קטן עם אנטנה - "מגבר" לפריצת רכבים. נארז למז״פ.',
    labResult: 'המכשיר שויך לרכישה מקוונת, וטביעות האצבע עליו: {culprit}.',
    sawText: 'בשלוש בלילה ראיתי {מישהו|מישהי} ב{clothes} {מסתובב|מסתובבת} בין המכוניות עם טלפון ביד. אחר כך שמעתי מנוע.',
    cameraText: 'המצלמה: 03:12, דמות ב{clothes} ניגשת לרכב, פותחת תוך עשר שניות ונוסעת. בעצירה ברמזור הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} יום לפני מצלם{|ת} את הרכב של {victim} בטלפון.',
    when: 'באותו לילה',
    roles: [
      { occupation: 'מכונא{י|ית} במוסך שכונתי', outfits: ['vest', 'tshirt'], motive: '{name} טיפל{|ה} ברכב של {victim} לפני שבועיים והחזיק{|ה} את המפתח יומיים.', alibi: 'רישומי המוסך והמצלמה שלו: {name} {היה|הייתה} במוסך עד חצות, ואז {צולם|צולמה} בתחנת דלק בחולון בשלוש.', alibiSource: 'document', confession: ['היה לי חוב לחלפים. מישהו הציע לי חמישה עשר אלף על רכב כזה.', 'שכפלתי את הקוד כשהרכב היה אצלי. זה היה קל מדי.'], opening: 'אני מתקן{|ת} מכוניות, לא גונב{|ת} אותן.' },
      { occupation: 'שומר{|ת} חניון', outfits: ['vest', 'leather'], motive: 'החניון היה באחריות {name}, והמצלמה הפנימית "התקלקלה" בדיוק באותו לילה.', alibi: 'המנהל של {name} מאשר שהיה חילוף משמרות, ו{name} יצא{|ה} כבר בעשר. יש חתימה ביומן.', alibiSource: 'testimony', confession: ['מישהו שילם לי לכבות את המצלמה לשעה. רק לכבות.', 'אחר כך הבנתי שזה לא מספיק, ולקחתי את הרכב בעצמי.'], opening: 'מצלמות מתקלקלות. זה לא הופך אותי לגנב{|ת}.' },
      { occupation: 'גנב{|ת} רכב מוכר{|ת}', outfits: ['hoodie', 'leather'], motive: '{name} הורשע{|ה} בעבר בגניבת רכבים באותה שיטה בדיוק, ושוחרר{|ה} בחודש שעבר.', alibi: 'האיזוק האלקטרוני של {name} מראה שלא יצא{|ה} מהבית בבת ים כל הלילה.', alibiSource: 'document', confession: ['אני לא יודע{|ת} לעשות שום דבר אחר. אף אחד לא מעסיק מי שישב.', 'ראיתי את הרכב הזה שבוע שלם. זה היה כמו פיתוי.'], opening: 'שילמתי על מה שעשיתי. נמאס שכל רכב שנעלם - אני.' },
    ],
  },
  {
    id: 'workTheft',
    crimeType: 'גניבה ממעביד',
    title: 'הכסף שנעלם מהקופה של {victim}',
    summary: 'מהכספת הקטנה בעסק של {victim}, ליד {place}, נעלמו שלושים אלף שקל. הכספת לא נפרצה. מישהו ידע את הקוד.',
    item: 'מעטפה קרועה',
    itemFound: 'בפח שמאחורי העסק נמצאה מעטפת בנק קרועה עם שאריות סרט הדבקה. נארזה למז״פ.',
    labResult: 'על סרט ההדבקה של המעטפה נמצאה טביעת אצבע: {culprit}.',
    sawText: 'אחרי הסגירה ראיתי {מישהו|מישהי} ב{clothes} {נכנס|נכנסת} שוב לעסק לחמש דקות, {ויוצא|ויוצאת} עם תיק גב.',
    cameraText: 'המצלמה מעל הקופה: 22:31, דמות ב{clothes} פותחת את הכספת בקוד, בלי לחפש. מכניסה מעטפות לתיק. הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} ליד הכספת בשבוע שעבר, ו{הסתלק|הסתלקה} מהר כש{victim} {v:נכנס|נכנסה}.',
    when: 'באותו ערב',
    roles: [
      { occupation: 'קופאי{|ת} בעסק', outfits: ['apron', 'tshirt'], motive: '{name} סיפר{|ה} לחברים לעבודה שהשכר לא מספיק לשכירות, ושבסוף "{יסתדר|תסתדר} לבד".', alibi: 'כרטיס הנוכחות ומצלמת האוטובוס מראים ש{name} יצא{|ה} מהעבודה בשמונה ונסע{|ה} ישר לבית ההורים בנתניה.', alibiSource: 'document', confession: ['שלוש שנים אני סופר{|ת} {v:לו|לה} את הכסף, ואין לי לשלם שכר דירה.', 'חשבתי שאחזיר עד סוף החודש. אף פעם לא מחזירים.'], opening: 'אני רק עובד{|ת} בקופה. אני לא יודע{|ת} אפילו את הקוד.' },
      { occupation: 'מנהל{|ת} משמרת', outfits: ['blazer', 'vest'], motive: '{name} היחיד{|ה} חוץ מהבעלים שיודע{|ת} את קוד הכספת, ולאחרונה {קנה|קנתה} רכב חדש.', alibi: 'רשומות הקופה ושלושה עובדים מאשרים: {name} {היה|הייתה} במשמרת בסניף השני ברמת החייל כל אותו ערב.', alibiSource: 'testimony', confession: ['הרכב החדש... ההלוואה עליו חנקה אותי.', 'ידעתי את הקוד. זה היה הכי קל בעולם, וזה הכי קשה עכשיו.'], opening: 'אני מנהל{|ת} את המקום הזה כמו שהוא שלי. למה שאגנוב מעצמי?' },
      { occupation: 'ספק{|ית} של העסק', outfits: ['vest', 'leather'], motive: '{victim} {v:איחר|איחרה} בתשלומים ל{name} חצי שנה, ו{name} {איים|איימה} ש"{ייקח|תיקח} את מה שמגיע {לו|לה}".', alibi: 'תעודות המשלוח ומעקב המשאית מראים ש{name} פרק{|ה} סחורה באשדוד עד מאוחר בלילה.', alibiSource: 'document', confession: ['חצי שנה {v:הוא לא שילם|היא לא שילמה} לי. חצי שנה!', 'ידעתי את הקוד מהפעם שעזרתי {v:לו|לה} לסגור. לקחתי את מה שחייבים לי.'], opening: '{v:הוא חייב|היא חייבת} לי כסף. זה לא סוד. אבל אני עובד{|ת} לפי החוק.' },
    ],
  },
  {
    id: 'rentalScam',
    crimeType: 'הונאה',
    title: 'הדירה שלא הייתה: הונאת שכירות ליד {place}',
    summary: '{victim} שילם{|ה} עשרים אלף שקל מקדמה על דירה ליד {place}. כשהגיע{|ה} עם המובילים, התברר שהדירה בכלל לא להשכרה, והמפתח לא פותח כלום.',
    item: 'חוזה שכירות מזויף',
    itemFound: '{victim} מוסר{|ת} את החוזה שקיבל{|ה}. על הדף חותמת וחתימה. נשלח למז״פ לבדיקת מסמכים.',
    labResult: 'בדיקת המסמך: החתימה זויפה, והחוזה הודפס במדפסת שנמצאה בבעלות {culprit}. טביעות האצבע על הדף - של {culprit}.',
    sawText: 'מי שהראה את הדירה {היה מישהו|הייתה מישהי} ב{clothes}. {הוא|היא} אמר{|ה} ש{הוא|היא} "מטעם הבעלים" ומיהר{|ה} כל הזמן.',
    cameraText: 'המצלמה בכניסה לבניין: 17:05, {victim} {v:נכנס|נכנסת} עם דמות ב{clothes}. הדמות פותחת עם מפתח של השכן. הפנים ברורות: {culprit}.',
    rumor: '{name} {נראה|נראתה} בבניין כמה פעמים בשבוע שעבר, עם אנשים שלא גרים שם.',
    when: 'בזמן שהראו את הדירה',
    roles: [
      { occupation: '{מתווך|מתווכת} עצמאי{|ת}', outfits: ['blazer', 'suit'], motive: '{name} {פרסם|פרסמה} את המודעה ביד2, ויש {נגדו|נגדה} שתי תלונות ישנות על "דמי תיווך שנעלמו".', alibi: 'בזמן הצגת הדירה {name} {היה|הייתה} בכנס מתווכים באילת. יש תמונות, רישום ונאום.', alibiSource: 'document', confession: ['השוק מת. אף אחד לא קונה, אף אחד לא שוכר.', 'זה התחיל מדירה אחת. כולם רצו להאמין שיש דירה במחיר כזה.'], opening: 'אני {מתווך|מתווכת} עשר שנים. אני לא צריך{|ה} לזייף כלום.' },
      { occupation: 'בעל{|ת} הדירה האמיתי{|ת}', outfits: ['blazer', 'tshirt'], motive: '{name} מחפש{|ת} כבר חודשים איך לפנות את השוכר הנוכחי, ו"השכרה כפולה" הייתה עוזרת.', alibi: 'שלושה שכנים ובן המשפחה מאשרים: {name} גר{|ה} בחו״ל כבר שנה, ולא {היה|הייתה} בארץ באותו חודש.', alibiSource: 'testimony', confession: ['השוכר לא משלם כבר חצי שנה, ובית המשפט לוקח שנים.', 'רציתי רק לגבות משהו. אחר כך זה יצא משליטה.'], opening: 'זו הדירה שלי. למה שאזייף חוזה על הדירה של עצמי?' },
      { occupation: 'השותף{|ה} בדירה השכנה', outfits: ['hoodie', 'tshirt'], motive: 'ל{name} יש מפתח לדירה השכנה, ו{הוא|היא} הציג{|ה} אותה בעבר "לחברים" בתשלום.', alibi: 'מנהל העבודה של {name} מראה דו״ח נוכחות מהמשמרת באתר הבנייה בהרצליה, עד שש בערב.', alibiSource: 'document', confession: ['היה לי מפתח, היה לי חוב, והייתה מודעה אחת ביד2.', 'לא חשבתי שמישהו יגיע עם מובילים. חשבתי {v:שהוא יוותר|שהיא תוותר}.'], opening: 'אני גר{|ה} ליד. זה לא הופך אותי לנוכל{|ת}.' },
    ],
  },
];

const W1_OPENERS = [
  'אני ראיתי הכל. טוב, לא הכל. אבל מספיק.',
  'סוף סוף מישהו שואל אותי. אני מחכה{|ה} פה מהבוקר.',
  'רק שלא יידעו שאני דיברתי, כן? אני גר{|ה} פה.',
  'כתבתי את זה בפתק כדי שלא אשכח. רגע... הנה.',
  'שתי דקות, אני באמצע משהו. טוב, מה אתם רוצים לדעת?',
];

const CAMERA_OPENERS = [
  'המצלמה שלי מכוונת לרחוב. תסתכלו כמה שאתם רוצים, רק אל תמחקו לי את המונדיאל.',
  'הסיסמה למערכת? 1234. מה, זה לא בטוח?',
  'קניתי את המצלמה אחרי שגנבו לי פעמיים את העציץ. סוף סוף היא שווה משהו.',
  'הנכד שלי התקין אותה. אני רק יודע{|ת} ללחוץ על המשולש.',
  'קחו את הדיסק. רק תחזירו, יש שם גם את החתונה של הבת שלי.',
];

const WITNESS_ROLES = [
  'שכן{|ה} מהבניין ממול',
  'עובר{|ת} אורח קבוע{|ה}',
  'מוכר{|ת} בחנות הסמוכה',
  'נהג{|ת} מונית ש{חיכה|חיכתה} ברחוב',
  'מנקה רחובות במשמרת לילה',
  'סטודנט{|ית} שגר{|ה} בקומה השנייה',
];

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

const ARCHIVE_CLERK: CharacterRef = {
  name: 'רס״ל נחמה גולן',
  role: 'ארכיון ומידע פלילי',
  look: { body: 'female', skin: '#e5b48f', hairStyle: 'bun', hairColor: '#6b4423', outfit: 'uniform', topColor: '#8fb0d4', pantsColor: '#1d2633', glasses: true },
};

/** A fourth possible suspect for each crime, used in some cases. */
const FOURTH_ROLES: Record<string, Role> = {
  burglary: { occupation: 'מנקה בעסק', outfits: ['apron', 'tshirt'], motive: '{name} מנקה את העסק פעמיים בשבוע ומחזיק{|ה} מפתח לדלת האחורית. לאחרונה {ביקש|ביקשה} מקדמה על המשכורת, ו{victim} {v:סירב|סירבה}.', alibi: 'בעלת הבית ש{name} מנקה אצלה בלילות מאשרת: {name} {היה|הייתה} אצלה ברמת גן עד הבוקר, ויש הודעות עם שעות.', alibiSource: 'testimony', confession: ['ביקשתי מקדמה של אלף שקל. אלף! {v:הוא צחק|היא צחקה} עליי.', 'היה לי מפתח. נכנסתי רק לקחת את מה ש{v:הוא חייב|היא חייבת} לי.'], opening: 'אני מנקה שם שלוש שנים. אם הייתי רוצה לגנוב, הייתי עושה את זה מזמן.' },
  robbery: { occupation: 'מוכר{|ת} בדוכן ממול', outfits: ['apron', 'vest'], motive: '{name} ו{victim} רבו בשבוע שעבר על מקום חניה, והשכנים שמעו את {name} {צועק|צועקת}: "עוד {v:תראה|תראי}".', alibi: 'הקופה של הדוכן מראה עסקאות של {name} כל הערב, כולל בשעת השוד. גם הלקוחות זוכרים.', alibiSource: 'document', confession: ['{v:הוא לקח|היא לקחה} לי את החניה, את הלקוחות, את הכל.', 'רציתי רק להפחיד. לא חשבתי שזה ייגמר בבית חולים.'], opening: 'רבנו על חניה. זה תל אביב, כולם רבים על חניה.' },
  assault: { occupation: 'שכ{ן|נה} מהקומה למטה', outfits: ['tshirt', 'hoodie'], motive: '{name} {הגיש|הגישה} נגד {victim} שתי תלונות על רעש, ובפעם האחרונה זה נגמר בדחיפות במדרגות.', alibi: '{name} {ביקר|ביקרה} את {אמו|אמה} בבית האבות עד אחרי חצות. יש רישום בכניסה ומצלמה בלובי.', alibiSource: 'document', confession: ['שנה שלמה של רעש עד שלוש בלילה. שנה!', 'ירדתי לבקש שקט, {v:והוא צחק|והיא צחקה} עליי. משהו נשבר.'], opening: 'כן, התלוננתי על רעש. זה לא פשע, זה הלילה שלי.' },
  carTheft: { occupation: 'סוחר{|ת} רכבים משומשים', outfits: ['blazer', 'leather'], motive: '{name} {הציע|הציעה} ל{victim} לקנות את הרכב לפני חודש, {v:והוא סירב|והיא סירבה}. מאז {נראה|נראתה} {name} כמה פעמים ליד החניה.', alibi: 'רישומי מכירה פומבית של רכבים באשדוד: {name} {היה|הייתה} שם עד הבוקר, עם קבלות ותמונות.', alibiSource: 'document', confession: ['הייתה לי קונה מוכנה. רק היה צריך רכב בדיוק כזה.', '{v:הוא לא רצה|היא לא רצתה} למכור. אז מצאתי דרך אחרת.'], opening: 'אני קונה ומוכר{|ת} רכבים. בשביל זה יש חוזה, לא מגבר.' },
  workTheft: { occupation: 'מנהל{|ת} החשבונות של העסק', outfits: ['suit', 'blazer'], motive: '{name} {גילה|גילתה} לפני חודש "פער" בספרים, ומאז {מתנהג|מתנהגת} מוזר. העובדים בטוחים ש{הוא מכסה|היא מכסה} על משהו.', alibi: 'בשעת הגניבה {name} {ישב|ישבה} בדיון בבית המשפט המחוזי, בתיק אחר לגמרי. יש פרוטוקול.', alibiSource: 'document', confession: ['ראיתי כמה כסף עובר שם, וכמה אני מרוויח{|ה}.', 'הקוד היה כתוב אצלי ביומן. זה כל הסיפור.'], opening: 'אני זה שגילה את הפער. למה שאגנוב ואז אדווח?' },
  rentalScam: { occupation: 'סטודנט{|ית} שגר{|ה} בדירה קודם', outfits: ['hoodie', 'tshirt'], motive: '{name} {עזב|עזבה} את הדירה לפני חודשיים ו"{שכח|שכחה}" להחזיר מפתח. {הוא|היא} גם {מכיר|מכירה} את בעל הבית ואת כל הבניין.', alibi: 'רשות ההגירה מאשרת: {name} {יצא|יצאה} לטיול בדרום אמריקה ועוד לא {חזר|חזרה}. הטלפון מחובר בפרו.', alibiSource: 'document', confession: ['היה לי מפתח והיה לי חוב. זה הכל.', 'חשבתי שזה רק פעם אחת. אחר כך הגיעו עוד פניות.'], opening: 'עזבתי את הדירה הזאת. מה לי ולה?' },
};

/** What the victim tells the detective. */
const VICTIM_STATEMENTS: Record<string, string> = {
  burglary: 'הגעתי בבוקר והדלת הייתה סגורה כרגיל. רק הקופה הייתה ריקה. מי שעשה את זה הכיר את המקום.',
  robbery: 'זה קרה בשנייה. דחיפה, משיכה, וכבר לא היה אף אחד. לא ראיתי פנים, רק את הבגד.',
  assault: 'שמעתי קול מאחוריי, ואז הכל נהיה שחור. אני {בטוח|בטוחה} שאני {מכיר|מכירה} את הקול הזה.',
  carTheft: 'חניתי כמו כל ערב. בבוקר - מקום ריק. האזעקה לא צפצפה בכלל.',
  workTheft: 'רק מעט אנשים יודעים את הקוד. אני לא רוצה להאמין שזה אחד מהם.',
  rentalScam: 'שילמתי במזומן, קיבלתי חוזה וחיוך. אפילו הראו לי איפה לשים את מכונת הכביסה.',
};

const VICTIM_OPENERS = ['סוף סוף. חיכיתי לכם מהבוקר.', 'אתם מהמשטרה? תודה שבאתם. אני עוד לא {מעכל|מעכלת}.', 'שאלו מה שאתם רוצים. רק תמצאו מי שעשה את זה.'];
const VISIT_OPENERS = [
  'משטרה? אצלי? מה עשיתי עכשיו?',
  'אם זה בקשר ל{victim} - שמעתי. מה אתם רוצים ממני?',
  'שתי דקות, אני באמצע משהו. טוב, שאלו.',
  'ידעתי שתגיעו. כולם פה כבר מדברים.',
];
const NEIGHBOR_ROLES = ['שכ{ן|נה} ותיק{|ה} מהרחוב', 'בעל{|ת} הדוכן הקרוב', 'יושב{|ת} קבוע{|ה} על הספסל', 'שליח{|ה} שעובר{|ת} פה כל יום'];
const AUTO_CAMERA_OWNERS = ['בעל{|ת} החנות הסמוכה', 'ועד הבית של הבניין ממול', 'בעל{|ת} הקיוסק הקרוב', 'מנהל{|ת} הסניף ממול', 'השכ{ן|נה} עם המצלמה במרפסת'];

const cache = new Map<number, CaseFile>();

interface Places {
  mapId: string;
  place: string;
  scene: string;
  w1: string;
  w2: string;
  neighbor: string;
  victim: string;
  camera: string;
  cameraOwner: string;
}

const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);

/** The n-th generated case (n starts at 1). Always the same for the same n. */
export function generateCase(n: number): CaseFile {
  const hit = cache.get(n);
  if (hit) return hit;
  // Places used by the cases just before this one stay theirs.
  const taken = new Set<string>();
  for (let k = Math.max(1, n - 4); k < n; k++) for (const h of generateCase(k).hotspots) taken.add(`${h.mapId}:${h.anchor}`);
  const free = (s: Spot) => !taken.has(`${s.mapId}:${s.anchor}`);

  const r = rng(n * 7919 + 17);
  const tpl = TEMPLATES[(n - 1 + Math.floor(r() * 3)) % TEMPLATES.length];
  const used = new Set<string>();
  const usedSpots = new Set<string>();
  const take = (s: Spot) => {
    usedSpots.add(s.anchor);
    return s.anchor;
  };
  const near = (from: Spot, min: number, max: number) =>
    shuffle(r, citySpots(from.mapId).filter((s) => free(s) && !usedSpots.has(s.anchor) && dist(s, from) >= min && dist(s, from) <= max));

  // Where it happened: odd cases use a hand-placed site, even cases any open
  // place in the city - so the scenes keep moving around.
  let places: Places | null = null;
  if (n % 2 === 0) {
    const mapId = pick(r, SCENE_MAP_IDS);
    const scenes = shuffle(r, citySpots(mapId).filter(free));
    for (const scene of scenes) {
      usedSpots.clear();
      usedSpots.add(scene.anchor);
      const around = near(scene, 2.5, 10);
      if (around.length < 5) continue;
      const [w1, w2, neighbor, victim] = around;
      const cam = around[4];
      places = {
        mapId,
        place: placeName(scene),
        scene: take(scene),
        w1: take(w1),
        w2: take(w2),
        neighbor: take(neighbor),
        victim: take(victim),
        camera: take(cam),
        cameraOwner: pick(r, AUTO_CAMERA_OWNERS),
      };
      break;
    }
  }
  if (!places) {
    usedSpots.clear();
    const site = SITES[Math.floor((n - 1) / 2) % SITES.length];
    const sceneAnchor = MAPS[site.mapId].anchors[site.scene];
    const from: Spot = { anchor: site.scene, mapId: site.mapId, x: sceneAnchor.x, y: sceneAnchor.y, street: '' };
    // The victim waits close to the scene: the nearest open place.
    const victim = near(from, 1.8, 99).sort((a, b) => dist(a, from) - dist(b, from))[0];
    places = {
      mapId: site.mapId,
      place: site.place,
      scene: site.scene,
      w1: site.witness1,
      w2: site.witness2,
      neighbor: site.alibi,
      victim: take(victim),
      camera: site.camera,
      cameraOwner: site.cameraOwner,
    };
  }
  /** An open place on another map than the scene (homes, alibis). */
  const visited = new Set<string>([places.mapId]);
  const elsewhere = () => {
    // Prefer a neighbourhood the case hasn't been to yet.
    const others = SCENE_MAP_IDS.filter((m) => m !== places!.mapId);
    const maps = [...shuffle(r, others.filter((m) => !visited.has(m))), ...shuffle(r, others.filter((m) => visited.has(m)))];
    for (const m of maps) {
      const s = shuffle(r, citySpots(m).filter((x) => free(x) && !usedSpots.has(x.anchor)))[0];
      if (s) {
        take(s);
        visited.add(m);
        return s;
      }
    }
    throw new Error('no free place left in the city');
  };

  const victim = person(r, used, ['tshirt', 'blazer', 'apron']);
  const count = r() < 0.5 ? 4 : 3;
  const roleList = [...tpl.roles, FOURTH_ROLES[tpl.id]];
  const people = shuffle(r, [0, 1, 2, 3])
    .slice(0, count)
    .map((ri) => {
      const role = roleList[ri];
      return { role, p: person(r, used, role.outfits) };
    });
  const culpritIdx = Math.floor(r() * count);
  const id = `gen-${n}`;
  const sid = (i: number) => `${id}-s${i}`;
  const culprit = people[culpritIdx];
  const innocents = people.map((_, i) => i).filter((i) => i !== culpritIdx);
  const [inA, inB, inC] = innocents;
  const w1 = person(r, used, ['tshirt', 'vest', 'blazer']);
  const w2 = person(r, used, ['tshirt', 'apron', 'hoodie']);
  const neighbor = person(r, used, ['tshirt', 'vest', 'apron', 'blazer']);
  const camOwner = person(r, used, ['vest', 'apron', 'tshirt'], places.cameraOwner.includes('{') ? undefined : false);
  const owner = g(places.cameraOwner, camOwner.female);
  const alibiWitness = person(r, used, ['blazer', 'tshirt']);
  const alibiWitnessC = person(r, used, ['blazer', 'vest', 'tshirt']);

  const vars = (p?: Person): Record<string, string> => ({
    victim: victim.name,
    place: places!.place,
    culprit: culprit.p.name,
    clothes: culprit.p.clothes,
    name: p?.name ?? '',
  });
  // {m|f} follows the person the sentence is about; {v:m|f} always the
  // victim and {c:m|f} always the culprit, wherever they are mentioned.
  const txt = (t: string, subject: Person) =>
    g(
      fill(t, vars(subject))
        .replace(/\{v:([^|{}]*)\|([^|{}]*)\}/g, (_, m: string, f: string) => (victim.female ? f : m))
        .replace(/\{c:([^|{}]*)\|([^|{}]*)\}/g, (_, m: string, f: string) => (culprit.p.female ? f : m)),
      subject.female,
    );
  const aboutVictim = (t: string) => txt(t, victim);
  const aboutCulprit = (t: string) => txt(t, culprit.p);
  const about = (i: number, t: string) => txt(t, people[i].p);

  const suspects: Suspect[] = people.map(({ role, p }, i) => ({
    id: sid(i),
    name: p.name,
    age: role.age ? role.age[0] + Math.floor(r() * (role.age[1] - role.age[0] + 1)) : 22 + Math.floor(r() * 35),
    occupation: txt(role.occupation, p),
    description: about(i, role.motive),
    look: p.look,
  }));
  suspects[culpritIdx].interrogation = {
    openingStatement: aboutCulprit(culprit.role.opening),
    pressureSensitivity: 11 + Math.floor(r() * 4),
    trustAffinity: 9 + Math.floor(r() * 4),
    startTension: 25 + Math.floor(r() * 15),
    startCooperation: 32 + Math.floor(r() * 15),
    breakThreshold: 7,
    keyEvidence: [`${id}-lab`, `${id}-cam`],
    lines: { pressure: [], trust: [], evidenceHit: [], evidenceKey: [], evidenceMiss: [], confrontFail: [], confrontSuccess: [], wavering: [] },
    confession: culprit.role.confession.map((t) => aboutCulprit(t)),
    lawyer: aboutCulprit('זהו. אני לא אומר{|ת} מילה בלי עורך דין.'),
    silence: g('אני שומר{|ת} על זכות השתיקה.', culprit.p.female),
  };

  const hangs = culprit.p.clothesFemale ? 'תלויה' : 'תלוי';
  const clues: Clue[] = [
    { id: `${id}-lab`, title: tpl.item, description: aboutVictim(tpl.itemFound), category: 'clue', source: 'physical', requiresLab: true, labResult: aboutCulprit(tpl.labResult), implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-cam`, title: `מצלמת ${owner}`, description: aboutCulprit(tpl.cameraText), category: 'clue', source: 'cctv', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-saw`, title: `עדות ${w1.name}`, description: aboutCulprit(tpl.sawText), category: 'clue', source: 'testimony', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-motive`, title: `המניע של ${culprit.p.name}`, description: aboutCulprit(culprit.role.motive), category: 'motive', source: 'testimony', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-clothes`, title: `ביקור אצל ${culprit.p.name}`, description: aboutCulprit(`בכניסה ${hangs} {clothes} - בדיוק כמו בתיאור של העדים. {name} {התעקש|התעקשה} שזה "של מישהו אחר".`), category: 'clue', source: 'physical', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-victim`, title: `עדות ${victim.name}`, description: aboutVictim(VICTIM_STATEMENTS[tpl.id]), category: 'clue', source: 'testimony', implicates: [], clears: [] },
    { id: `${id}-motiveA`, title: `המניע של ${people[inA].p.name}`, description: about(inA, people[inA].role.motive), category: 'motive', source: 'testimony', implicates: [sid(inA)], clears: [] },
    { id: `${id}-rumorA`, title: `שמועה על ${people[inA].p.name}`, description: about(inA, tpl.rumor), category: 'clue', source: 'testimony', implicates: [sid(inA)], clears: [] },
    { id: `${id}-motiveB`, title: `המניע של ${people[inB].p.name}`, description: about(inB, people[inB].role.motive), category: 'motive', source: 'testimony', implicates: [sid(inB)], clears: [] },
    { id: `${id}-alibiA`, title: `האליבי של ${people[inA].p.name}`, description: about(inA, people[inA].role.alibi), category: 'alibi', source: people[inA].role.alibiSource, implicates: [], clears: [sid(inA)] },
    { id: `${id}-alibiB`, title: `האליבי של ${people[inB].p.name}`, description: about(inB, people[inB].role.alibi), category: 'alibi', source: 'document', implicates: [], clears: [sid(inB)] },
  ];
  if (inC !== undefined) {
    clues.push(
      { id: `${id}-motiveC`, title: `המניע של ${people[inC].p.name}`, description: about(inC, people[inC].role.motive), category: 'motive', source: 'testimony', implicates: [sid(inC)], clears: [] },
      { id: `${id}-alibiC`, title: `האליבי של ${people[inC].p.name}`, description: about(inC, people[inC].role.alibi), category: 'alibi', source: people[inC].role.alibiSource, implicates: [], clears: [sid(inC)] },
    );
  }
  // Each innocent suspect's own version, heard at their door.
  for (const i of innocents)
    clues.push({ id: `${id}-ver${i}`, title: `הגרסה של ${people[i].p.name}`, description: about(i, '{name} {מכחיש|מכחישה} כל קשר ו{טוען|טוענת} ש{היה|הייתה} במקום אחר בזמן האירוע. {הוא|היא} {מפנה|מפנה} אתכם למי שיכול לאשר.'), category: 'clue', source: 'testimony', implicates: [], clears: [] });

  const P = places;
  const witnessRole = (p: Person) => g(pick(r, WITNESS_ROLES), p.female);
  const hotspots: MapHotspot[] = [
    {
      id: `${id}-h-scene`, mapId: P.mapId, anchor: P.scene, kind: 'collect', label: 'איסוף ראיה', title: `הזירה - ${P.place}`,
      dialogue: [{ speaker: 'יומן חקירה', text: aboutVictim(tpl.itemFound) }], evidenceIds: [`${id}-lab`],
    },
    {
      id: `${id}-h-victim`, mapId: P.mapId, anchor: P.victim, kind: 'witness', label: 'שיחה עם הקורבן', title: g(`${victim.name} - {המתלונן|המתלוננת}`, victim.female),
      character: ref(victim, g('{המתלונן|המתלוננת}', victim.female)),
      dialogue: [
        { speaker: victim.name, text: g(pick(r, VICTIM_OPENERS), victim.female) },
        { speaker: victim.name, text: aboutVictim(VICTIM_STATEMENTS[tpl.id]) },
        { speaker: victim.name, text: `ועוד משהו שכדאי שתדעו: ${about(inB, people[inB].role.motive)}` },
      ],
      evidenceIds: [`${id}-victim`, `${id}-motiveB`],
    },
    {
      id: `${id}-h-w1`, mapId: P.mapId, anchor: P.w1, kind: 'witness', label: 'תשאול עד', title: g(`${w1.name} - עד{|ה} ראייה`, w1.female),
      character: ref(w1, witnessRole(w1)),
      dialogue: [
        { speaker: w1.name, text: g(pick(r, W1_OPENERS), w1.female) },
        { speaker: w1.name, text: aboutCulprit(tpl.sawText) },
      ],
      evidenceIds: [`${id}-saw`],
    },
    {
      id: `${id}-h-w2`, mapId: P.mapId, anchor: P.w2, kind: 'witness', label: 'תשאול עד', title: g(`${w2.name} - מכיר{|ה} את כולם`, w2.female),
      character: ref(w2, witnessRole(w2)),
      dialogue: [
        { speaker: w2.name, text: aboutCulprit(culprit.role.motive) },
        { speaker: w2.name, text: `${about(inA, people[inA].role.motive)} ${g(pick(r, ['מוזר, לא?', 'אני רק אומר{|ת}.', 'תעשו עם זה מה שאתם רוצים.']), w2.female)}` },
      ],
      evidenceIds: [`${id}-motive`, `${id}-motiveA`],
    },
    {
      id: `${id}-h-neighbor`, mapId: P.mapId, anchor: P.neighbor, kind: 'witness', label: 'תשאול עד', title: g(`${neighbor.name} - ${pick(r, NEIGHBOR_ROLES)}`, neighbor.female),
      character: ref(neighbor, g('תושב{|ת} השכונה', neighbor.female)),
      dialogue: [
        { speaker: neighbor.name, text: g('אני לא אוהב{|ת} לדבר על אנשים. אבל מה שראיתי - ראיתי.', neighbor.female) },
        { speaker: neighbor.name, text: about(inA, tpl.rumor) },
        ...(inC !== undefined ? [{ speaker: neighbor.name, text: `ושמעתי עוד משהו: ${about(inC, people[inC].role.motive)}` }] : []),
      ],
      evidenceIds: [`${id}-rumorA`, ...(inC !== undefined ? [`${id}-motiveC`] : [])],
    },
    {
      id: `${id}-h-cam`, mapId: P.mapId, anchor: P.camera, kind: 'cctv', label: 'בדיקת מצלמות אבטחה', title: `המצלמה של ${owner}`,
      character: ref(camOwner, owner),
      dialogue: [
        { speaker: camOwner.name, text: g(pick(r, CAMERA_OPENERS), camOwner.female) },
        { speaker: 'יומן חקירה', text: aboutCulprit(tpl.cameraText) },
      ],
      evidenceIds: [`${id}-cam`],
    },
  ];
  // A visit to each suspect, wherever they live or work in the city.
  people.forEach(({ role, p }, i) => {
    const spot = elsewhere();
    const isCulprit = i === culpritIdx;
    hotspots.push({
      id: `${id}-h-visit${i}`, mapId: spot.mapId, anchor: spot.anchor, kind: 'witness', label: 'שיחה עם חשוד', title: `${p.name} - ${placeName(spot)}`,
      character: ref(p, g(`חשוד{|ה} - ${txt(role.occupation, p)}`, p.female)),
      dialogue: [
        { speaker: p.name, text: txt(pick(r, VISIT_OPENERS), p) },
        { speaker: p.name, text: txt(role.opening, p) },
        isCulprit
          ? { speaker: 'יומן חקירה', text: aboutCulprit(`בכניסה ${hangs} {clothes} - בדיוק כמו בתיאור של העדים. {name} {התעקש|התעקשה} שזה "של מישהו אחר".`) }
          : { speaker: p.name, text: txt('באותו זמן בכלל לא הייתי שם. יש מי שיכול לאשר. תבדקו.', p) },
      ],
      evidenceIds: [isCulprit ? `${id}-clothes` : `${id}-ver${i}`],
    });
  });
  const alibiSpot = elsewhere();
  hotspots.push(
    {
      id: `${id}-h-alibiA`, mapId: alibiSpot.mapId, anchor: alibiSpot.anchor, kind: 'witness', label: 'בירור אליבי', title: `בירור האליבי של ${people[inA].p.name}`,
      character: ref(alibiWitness, g('מכיר{|ה} של החשוד', alibiWitness.female)),
      dialogue: [
        { speaker: alibiWitness.name, text: about(inA, `אתם מחפשים את {name}? ${tpl.when}? שבו, אני אסביר.`) },
        { speaker: alibiWitness.name, text: about(inA, people[inA].role.alibi) },
      ],
      evidenceIds: [`${id}-alibiA`],
    },
    {
      id: `${id}-h-archive`, mapId: 'station', anchor: 'st-archive', kind: 'cctv', label: 'בדיקת מודיעין', title: `ארכיון - ${people[inB].p.name}`,
      character: ARCHIVE_CLERK,
      dialogue: [
        { speaker: ARCHIVE_CLERK.name, text: `הרצתי את ${people[inB].p.name} בכל המערכות. יש לי משהו בשבילך.` },
        { speaker: ARCHIVE_CLERK.name, text: about(inB, people[inB].role.alibi) },
      ],
      evidenceIds: [`${id}-alibiB`],
    },
  );
  if (inC !== undefined) {
    const spotC = elsewhere();
    hotspots.push({
      id: `${id}-h-alibiC`, mapId: spotC.mapId, anchor: spotC.anchor, kind: 'witness', label: 'בירור אליבי', title: `בירור האליבי של ${people[inC].p.name}`,
      character: ref(alibiWitnessC, g('מכיר{|ה} של החשוד', alibiWitnessC.female)),
      dialogue: [
        { speaker: alibiWitnessC.name, text: `${g(`${people[inC].p.name}? ${tpl.when}? אני יודע{|ת} בדיוק איפה`, alibiWitnessC.female)} ${g('{הוא|היא} {היה|הייתה}.', people[inC].p.female)}` },
        { speaker: alibiWitnessC.name, text: about(inC, people[inC].role.alibi) },
      ],
      evidenceIds: [`${id}-alibiC`],
    });
  }

  const mapIds = [...new Set(hotspots.map((h) => h.mapId))];
  const caseFile: CaseFile = {
    id,
    order: 100 + n,
    unlockAfter: n + 2,
    title: aboutVictim(tpl.title),
    shortTitle: `${tpl.crimeType}: ${victim.name}`,
    crimeType: tpl.crimeType,
    locationName: P.place,
    summary: aboutVictim(tpl.summary),
    briefing: [
      aboutVictim(`תיק חדש מהמשמרת. ${tpl.crimeType} ליד ${P.place}. הקורבן: ${victim.name}.`),
      `${count === 4 ? 'ארבעה' : 'שלושה'} שמות כבר עולים בשכונה. אל תיתנו לשמועות להחליט בשבילכם - תאספו, תבדקו, תחברו.`,
      'הזירה, המצלמות, העדים, ביקור אצל כל חשוד. ותבדקו אליבי לפני שאתם מסמנים מישהו.',
    ],
    closingStatement: aboutCulprit(`${culprit.p.name} {הודה|הודתה} ב${tpl.crimeType === 'הונאה' ? 'הונאה' : 'מעשה'}. ${victim.name} {v:קיבל|קיבלה} תשובה, והשכונה - עוד סיבה להאמין שמישהו בודק עד הסוף.`),
    mapIds,
    culpritId: sid(culpritIdx),
    suspects,
    clues,
    hotspots,
    hints: [
      `תתחילו מ${P.place}. מה שנשאר בזירה הולך למז״פ, ו${victim.name} מחכה לכם שם.`,
      `${owner} - יש שם מצלמה שמכוונת לרחוב.`,
      'לכל אחד מהחשודים יש מניע. רק לאחד אין אליבי. ביקור בבית של כל אחד מהם יכול לגלות הרבה.',
    ],
    generated: true,
  };
  cache.set(n, caseFile);
  return caseFile;
}
