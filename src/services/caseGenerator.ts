// Endless cases: after the story cases, new files keep landing on the desk.
// Every generated case is built from a crime template, a place on one of the
// maps, three freshly generated suspects and the witnesses around them. The
// structure always holds together: the culprit is tied by four pieces of
// evidence (a lab item and a camera are the key ones), each innocent suspect
// draws one or two false leads and has an alibi that clears them.
import type { CaseFile, CharacterLook, CharacterRef, Clue, MapHotspot, Suspect } from '../types/investigation';

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
  return { name, female, look, clothes: `${garment.name} ${garment.female ? color.f : color.m}` };
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
      { occupation: 'שליח{|ה}', outfits: ['vest', 'hoodie'], motive: '{name} {נראה|נראתה} באזור כמה פעמים באותו ערב, ולפי השכנים "מסתכל{|ת} על אנשים יותר מעל משלוחים".', alibi: 'האפליקציה של חברת המשלוחים מראה ש{name} {היה|הייתה} באמצע משלוח בבת ים בשעת השוד.', alibiSource: 'document', confession: ['האפליקציה הורידה לי את המשכורת בחצי. היו לי חובות.', 'ראיתי את התיק פתוח, ראיתי את המזומנים. זה לקח שנייה.'], opening: 'אני עובד{|ת} כל היום על קורקינט. אין לי זמן לשדוד אף אחד.' },
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

const cache = new Map<number, CaseFile>();

/** The n-th generated case (n starts at 1). Always the same for the same n. */
export function generateCase(n: number): CaseFile {
  const hit = cache.get(n);
  if (hit) return hit;
  const r = rng(n * 7919 + 17);
  const tpl = TEMPLATES[(n - 1 + Math.floor(r() * 3)) % TEMPLATES.length];
  const site = SITES[(n - 1) % SITES.length];
  const used = new Set<string>();
  const victim = person(r, used, ['tshirt', 'blazer', 'apron']);
  const roles = shuffle(r, [0, 1, 2]);
  const people = roles.map((ri) => {
    const role = tpl.roles[ri];
    return { role, p: person(r, used, role.outfits) };
  });
  const culpritIdx = Math.floor(r() * 3);
  const id = `gen-${n}`;
  const sid = (i: number) => `${id}-s${i}`;
  const culprit = people[culpritIdx];
  const innocents = [0, 1, 2].filter((i) => i !== culpritIdx);
  const [inA, inB] = innocents;
  const w1 = person(r, used, ['tshirt', 'vest', 'blazer']);
  const w2 = person(r, used, ['tshirt', 'apron', 'hoodie']);
  const camOwner = person(r, used, ['vest', 'apron', 'tshirt'], site.cameraOwner.includes('{') ? undefined : false);
  const owner = g(site.cameraOwner, camOwner.female);
  const alibiWitness = person(r, used, ['blazer', 'tshirt']);

  const vars = (p?: Person): Record<string, string> => ({
    victim: victim.name,
    place: site.place,
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
    silence: 'אני שומר על זכות השתיקה.',
  };

  const clues: Clue[] = [
    { id: `${id}-lab`, title: tpl.item, description: aboutVictim(tpl.itemFound), category: 'clue', source: 'physical', requiresLab: true, labResult: aboutCulprit(tpl.labResult), implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-cam`, title: `מצלמת ${owner}`, description: aboutVictim(aboutCulprit(tpl.cameraText)), category: 'clue', source: 'cctv', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-saw`, title: `עדות ${w1.name}`, description: aboutCulprit(tpl.sawText), category: 'clue', source: 'testimony', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-motive`, title: `המניע של ${culprit.p.name}`, description: aboutVictim(aboutCulprit(culprit.role.motive)), category: 'motive', source: 'testimony', implicates: [sid(culpritIdx)], clears: [] },
    { id: `${id}-motiveA`, title: `המניע של ${people[inA].p.name}`, description: aboutVictim(about(inA, people[inA].role.motive)), category: 'motive', source: 'testimony', implicates: [sid(inA)], clears: [] },
    { id: `${id}-rumorA`, title: `שמועה על ${people[inA].p.name}`, description: about(inA, tpl.rumor), category: 'clue', source: 'testimony', implicates: [sid(inA)], clears: [] },
    { id: `${id}-motiveB`, title: `המניע של ${people[inB].p.name}`, description: aboutVictim(about(inB, people[inB].role.motive)), category: 'motive', source: 'testimony', implicates: [sid(inB)], clears: [] },
    { id: `${id}-alibiA`, title: `האליבי של ${people[inA].p.name}`, description: aboutVictim(about(inA, people[inA].role.alibi)), category: 'alibi', source: people[inA].role.alibiSource, implicates: [], clears: [sid(inA)] },
    { id: `${id}-alibiB`, title: `האליבי של ${people[inB].p.name}`, description: aboutVictim(about(inB, people[inB].role.alibi)), category: 'alibi', source: 'document', implicates: [], clears: [sid(inB)] },
  ];

  const witnessRole = (p: Person) => g(pick(r, WITNESS_ROLES), p.female);
  const hotspots: MapHotspot[] = [
    {
      id: `${id}-h-scene`, mapId: site.mapId, anchor: site.scene, kind: 'collect', label: 'איסוף ראיה', title: `הזירה - ${site.place}`,
      dialogue: [{ speaker: 'יומן חקירה', text: aboutVictim(tpl.itemFound) }], evidenceIds: [`${id}-lab`],
    },
    {
      id: `${id}-h-w1`, mapId: site.mapId, anchor: site.witness1, kind: 'witness', label: 'תשאול עד', title: `${w1.name} - עד{|ה} ראייה`.replace('{|ה}', w1.female ? 'ה' : ''),
      character: ref(w1, witnessRole(w1)),
      dialogue: [
        { speaker: w1.name, text: g(pick(r, W1_OPENERS), w1.female) },
        { speaker: w1.name, text: aboutCulprit(tpl.sawText) },
        { speaker: w1.name, text: `ועוד דבר שכולם פה יודעים: ${about(inA, people[inA].role.motive)}` },
      ],
      evidenceIds: [`${id}-saw`, `${id}-motiveA`],
    },
    {
      id: `${id}-h-w2`, mapId: site.mapId, anchor: site.witness2, kind: 'witness', label: 'תשאול עד', title: `${w2.name} - מכיר{|ה} את כולם`.replace('{|ה}', w2.female ? 'ה' : ''),
      character: ref(w2, witnessRole(w2)),
      dialogue: [
        { speaker: w2.name, text: aboutVictim(aboutCulprit(culprit.role.motive)) },
        { speaker: w2.name, text: `${about(inA, tpl.rumor)} ${g(pick(r, ['מוזר, לא?', 'אני רק אומר{|ת}.', 'תעשו עם זה מה שאתם רוצים.']), w2.female)}` },
        { speaker: w2.name, text: aboutVictim(about(inB, people[inB].role.motive)) },
      ],
      evidenceIds: [`${id}-motive`, `${id}-rumorA`, `${id}-motiveB`],
    },
    {
      id: `${id}-h-cam`, mapId: site.mapId, anchor: site.camera, kind: 'cctv', label: 'בדיקת מצלמות אבטחה', title: `המצלמה של ${owner}`,
      character: ref(camOwner, owner),
      dialogue: [
        { speaker: camOwner.name, text: g(pick(r, CAMERA_OPENERS), camOwner.female) },
        { speaker: 'יומן חקירה', text: aboutVictim(aboutCulprit(tpl.cameraText)) },
      ],
      evidenceIds: [`${id}-cam`],
    },
    {
      id: `${id}-h-alibiA`, mapId: site.mapId, anchor: site.alibi, kind: 'witness', label: 'תשאול עד', title: `בירור האליבי של ${people[inA].p.name}`,
      character: ref(alibiWitness, g('מכיר{|ה} של החשוד', alibiWitness.female)),
      dialogue: [
        { speaker: alibiWitness.name, text: about(inA, `אתם מחפשים את {name}? ${tpl.when}? שבו, אני אסביר.`) },
        { speaker: alibiWitness.name, text: aboutVictim(about(inA, people[inA].role.alibi)) },
      ],
      evidenceIds: [`${id}-alibiA`],
    },
    {
      id: `${id}-h-archive`, mapId: 'station', anchor: 'st-archive', kind: 'cctv', label: 'בדיקת מודיעין', title: `ארכיון - ${people[inB].p.name}`,
      character: ARCHIVE_CLERK,
      dialogue: [
        { speaker: ARCHIVE_CLERK.name, text: `הרצתי את ${people[inB].p.name} בכל המערכות. יש לי משהו בשבילך.` },
        { speaker: ARCHIVE_CLERK.name, text: aboutVictim(about(inB, people[inB].role.alibi)) },
      ],
      evidenceIds: [`${id}-alibiB`],
    },
  ];

  const caseFile: CaseFile = {
    id,
    order: 100 + n,
    unlockAfter: n + 2,
    title: aboutVictim(tpl.title),
    shortTitle: `${tpl.crimeType}: ${victim.name}`,
    crimeType: tpl.crimeType,
    locationName: site.place,
    summary: aboutVictim(tpl.summary),
    briefing: [
      aboutVictim(`תיק חדש מהמשמרת. ${tpl.crimeType} ליד ${site.place}. הקורבן: ${victim.name}.`),
      'שלושה שמות כבר עולים בשכונה. אל תיתנו לשמועות להחליט בשבילכם - תאספו, תבדקו, תחברו.',
      'הזירה, המצלמות, העדים. ותבדקו אליבי לפני שאתם מסמנים מישהו.',
    ],
    closingStatement: aboutVictim(aboutCulprit(`${culprit.p.name} {הודה|הודתה} ב${tpl.crimeType === 'הונאה' ? 'הונאה' : 'מעשה'}. ${victim.name} {v:קיבל|קיבלה} תשובה, והשכונה - עוד סיבה להאמין שמישהו בודק עד הסוף.`)),
    mapIds: [site.mapId, 'station'],
    culpritId: sid(culpritIdx),
    suspects,
    clues,
    hotspots,
    hints: [
      `תתחילו מ${site.place}. מה שנשאר בזירה הולך למז״פ.`,
      `${owner} - יש שם מצלמה שמכוונת לרחוב.`,
      'לכל אחד מהחשודים יש מניע. רק לאחד אין אליבי.',
    ],
    generated: true,
  };
  cache.set(n, caseFile);
  return caseFile;
}
