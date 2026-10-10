import { MapBuilder, look } from '../builder';
import { RESIDENT_LINES, STREET_LINES, VENDOR_LINES } from '../lines';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../person';

export function buildNeveShaanan() {
  const b = new MapBuilder('neveShaanan', 60, 46);
  b.fill(0, 0, 60, 46, Tile.Concrete);
  b.fill(0, 0, 60, 1, Tile.Wall, WallStyle.Plaster);
  b.hroad(2, 0, 59, 1, 1);
  b.prop('car', 6, 2);
  b.prop('car', 30, 2, { variant: 1 });
  b.prop('car', 47, 2, { color: '#e0ded6' });
  b.label(20, 2.9, 'רחוב צ׳לנוב');

  /* Shops along the pedestrian street */
  b.building({ id: 'ns-kiosk-b', x: 0, y: 5, w: 7, h: 13, wall: WallStyle.Plaster, floor: FloorStyle.Lino, doors: [3], sign: { text: 'קיוסק אבו עלי', color: '#1d4ed8', x: 1, w: 3 }, windows: false });
  b.prop('counter', 1, 13, { w: 3, color: '#4a3a2c', name: 'דלפק הקיוסק', examine: 'סיגריות, כרטיסי חיוג, מסטיקים ומטענים בעשרה שקלים.' });
  b.prop('fridge', 5, 6);
  b.prop('fridge', 4, 6);
  b.prop('crate', 1, 6);
  b.prop('cctvBox', 1, 9, { name: 'מערכת המצלמות של הקיוסק' });
  b.anchor('ns-kiosk', 2.5, 12.4, DIR_DOWN);
  b.label(3.5, 6.4, 'קיוסק', 'room', 'ns-kiosk-b');

  b.building({ id: 'ns-barber-b', x: 7, y: 5, w: 8, h: 13, wall: WallStyle.White, floor: FloorStyle.Checker, doors: [3], sign: { text: 'מספרת יוסף', color: '#7f1d1d', x: 4, w: 3 } });
  b.prop('mirror', 8, 5, { name: 'מראה', examine: 'מראה גדולה עם תמונות של תסרוקות משנות התשעים.' });
  b.prop('mirror', 11, 5, { name: 'מראה', examine: 'על המראה מודבק פתק: "תספורת 40, זקן 20".' });
  b.prop('chair', 9, 7, { name: 'כיסא ספר', examine: 'כיסא ספר הידראולי עם ריפוד אדום.' });
  b.prop('chair', 12, 7, { name: 'כיסא ספר', examine: 'כיסא ספר. על הרצפה מתחתיו - שיער.' });
  b.prop('sofa', 9, 13, { color: '#3f3f46' });
  b.prop('cctvBox', 13, 9, { name: 'מסך המצלמה', examine: 'מסך קטן שמראה את הרחוב מבחוץ.' });
  b.anchor('ns-barber', 11.5, 9.5, DIR_DOWN);
  b.npc({ x: 9.5, y: 8.4, dir: DIR_UP, name: 'לקוח', role: 'מסתפר', look: look('male', '#6b4430', 'buzz', '#16120f', 'tshirt', '#e7e5e4'), lines: ['רגע, הוא באמצע. {אל תזיז|אל תזיזי} לו את היד, יש לו מספריים.', 'אני בא לפה כל שבוע. יוסף יודע הכל על כולם. גם דברים שאני לא יודע על עצמי.', 'ביקשתי "קצת מהצדדים". תראה{|י} מה יצא. אני בעד עדות נגדו.'] });
  b.label(10.5, 6.4, 'מספרה', 'room', 'ns-barber-b');

  b.building({ id: 'ns-phones', x: 15, y: 5, w: 7, h: 13, wall: WallStyle.Plaster, sign: { text: 'סלולר פלוס', color: '#22d3ee', neon: true, x: 2, w: 3 } });

  b.building({ id: 'ns-transfer', x: 22, y: 5, w: 10, h: 13, wall: WallStyle.Stone, floor: FloorStyle.Tile, doors: [4], sign: { text: 'אסמרה אקספרס', color: '#065f46', x: 5, w: 4 } });
  b.prop('counter', 23, 11, { w: 4, color: '#3d4a5a', name: 'דלפק העברות', examine: 'דלפק עם חלון זכוכית ומחשב. טפסים בטיגרינית, ערבית ועברית.' });
  b.prop('safe', 30, 6, { examine: 'כספת חומה. הדלת סגורה עכשיו, אבל אין עליה שום סימן פריצה.' });
  b.prop('cabinet', 23, 6);
  b.prop('desk', 27, 7, { variant: 1, name: 'שולחן הבעלים', examine: 'שולחן עם ספר הזמנות, מחשבון וכוס תה עם נענע.' });
  b.prop('poster', 25, 5, { examine: 'לוח שערים: דולר, אירו, נאקפה.' });
  b.anchor('ns-transfer-owner', 29.5, 12.4, DIR_LEFT);
  b.anchor('ns-transfer-door', 26.5, 15.2, DIR_DOWN);
  b.label(26.5, 6.4, 'משרד העברות', 'room', 'ns-transfer');

  b.building({ id: 'ns-rest', x: 32, y: 5, w: 11, h: 13, wall: WallStyle.Pink, floor: FloorStyle.Wood, doors: [5], sign: { text: 'מסעדה אריתראית', color: '#9a3412', x: 1, w: 4 } });
  b.prop('table', 33, 7);
  b.prop('table', 33, 11);
  b.prop('table', 36, 9);
  b.prop('counter', 39, 7, { w: 3, color: '#5b3a24', name: 'הדלפק של אלם', examine: 'סיר של צ׳יקן צ׳יצ׳ה וערימת אינג׳רה.' });
  b.prop('rug', 36, 13, { w: 3, h: 2, color: '#7c2d12' });
  b.anchor('ns-restaurant', 40.5, 9.5, DIR_DOWN);
  b.npc({ x: 35.5, y: 12.5, dir: DIR_LEFT, name: 'סועד', role: 'עובד בניין', look: look('male', '#6b4430', 'short', '#16120f', 'tshirt', '#4b5a6b'), lines: ['האוכל פה כמו בבית. בלי אמא שאומרת שאני רזה.', 'שומר הלילה? הוא איש טוב. כולם פה יודעים שזה לא הוא.', 'פה אוכלים עם הידיים. {תנסה|תנסי}. אף אחד לא שופט. טוב, קצת.'] });
  b.label(37.5, 6.4, 'מסעדה', 'room', 'ns-rest');

  b.building({ id: 'ns-shelter', x: 43, y: 5, w: 9, h: 13, wall: WallStyle.Concrete, floor: FloorStyle.Concrete, doors: [4], sign: { text: 'מקלט לילה', color: '#334155', x: 1, w: 3 }, lights: '#cfd8c0' });
  b.prop('mattress', 44, 7);
  b.prop('mattress', 48, 7);
  b.prop('mattress', 44, 10);
  b.prop('mattress', 48, 10);
  b.prop('lockers', 44, 13);
  b.label(47.5, 6.4, 'מקלט לילה', 'room', 'ns-shelter');
  b.building({ id: 'ns-apt', x: 52, y: 5, w: 8, h: 13, wall: WallStyle.Brick });

  b.npc({ x: 18.5, y: 18.7, dir: DIR_DOWN, name: 'אלי', role: 'מתקן טלפונים', look: look('male', '#c98f66', 'short', '#16120f', 'hoodie', '#0e7490', '#22252b', { glasses: true }), lines: [
    'תיקון מסך - מאה שקל. מסך מקורי? מה זה משנה, הוא נראה מקורי.',
    'יש לי מטען לכל טלפון שיצא מאז 2003. חוץ משלך. תמיד חוץ משלך.',
    'הטלפון שלך איטי? זה לא הטלפון. זה {אתה|את}. טוב, גם הטלפון.',
  ] });
  b.prop('cat', 22, 22, { color: '#6b7280' });

  /* Pedestrian street */
  b.fill(0, 18, 60, 6, Tile.Sidewalk, 1);
  [[3, 21], [14, 22], [25, 21], [36, 22], [54, 21]].forEach(([x, y]) => b.prop('tree', x, y));
  b.prop('bench', 7, 21);
  b.prop('bench', 29, 22);
  b.prop('bench', 50, 22);
  [6, 31, 56].forEach((x) => b.prop('lamp', x, 18));
  [19, 41].forEach((x) => b.prop('lamp', x, 22));
  b.prop('scooter', 16, 19, { name: 'קורקינט משלוחים', examine: 'קורקינט משלוחים עם ארגז תרמי נעול. מישהו פה עובד קשה. או משהו.' });
  b.anchor('ns-scooter', 16.5, 20.4, DIR_DOWN);
  b.prop('scooter', 33, 19);
  b.prop('stall', 42, 21, { color: '#475569', variant: 3, name: 'דוכן בגדים', examine: 'בגדים יד שנייה, נעלי ספורט ומטעני טלפון.' });
  b.prop('cardboard', 22, 23);
  b.prop('trash', 46, 23);
  b.prop('dumpster', 23, 22, { name: 'הפח של רחוב החנויות' });
  b.anchor('ns-sim-bin', 25.5, 22.6, DIR_LEFT);
  b.anchor('ns-shelter-guard', 48.5, 18.7, DIR_DOWN);
  b.label(28, 20.5, 'מדרחוב נווה שאנן');
  b.npc({ x: 43.5, y: 20.5, dir: DIR_DOWN, name: 'סלומון', role: 'מוכר בגדים', look: look('male', '#6b4430', 'curly', '#16120f', 'leather', '#2b2b2e'), lines: VENDOR_LINES });
  b.npc({ x: 5.5, y: 19.5, dir: DIR_RIGHT, name: 'עובר אורח', role: 'מבקש מקלט', look: look('male', '#6b4430', 'short', '#16120f', 'hoodie', '#5e1f26'), lines: STREET_LINES, path: [{ x: 1.5, y: 19.5 }, { x: 58.5, y: 19.5 }], speed: 1 });
  b.npc({ x: 50.5, y: 23.6, dir: DIR_LEFT, name: 'עוברת אורח', role: 'מנקה בבית מלון', look: look('female', '#6b4430', 'bun', '#16120f', 'tshirt', '#a3472b'), lines: STREET_LINES.slice(2), path: [{ x: 58.5, y: 23.6 }, { x: 1.5, y: 23.6 }], speed: 0.9 });

  /* Neighborhood garden */
  b.fill(0, 24, 18, 22, Tile.Grass);
  b.fill(8, 24, 1, 22, Tile.Dirt);
  b.fill(0, 34, 18, 1, Tile.Dirt);
  [[2, 26], [13, 27], [5, 31], [15, 32], [3, 38], [12, 40], [6, 43]].forEach(([x, y]) => b.prop('tree', x, y));
  b.prop('mattress', 2, 29);
  b.prop('cardboard', 4, 29);
  b.prop('mattress', 11, 36);
  b.prop('bench', 10, 25);
  b.prop('bench', 13, 37);
  b.prop('lamp', 9, 30);
  b.prop('lamp', 7, 41);
  b.label(4, 35.6, 'גינת נווה שאנן');
  b.npc({ x: 3.5, y: 30.5, dir: DIR_RIGHT, name: 'מיכאל', role: 'חסר בית', look: look('male', '#e5b48f', 'long', '#8d877f', 'hoodie', '#3b3a36', '#2d3440', { beard: true }), lines: [
    'אני ישן פה כבר שנתיים. בלילות אני רואה דברים שאף אחד לא רואה.',
    'בלילה של הפריצה? ראיתי אוטו טוב נכנס לרחוב, לא מהשכונה. אוטו נקי, מבריק.',
    'יש משהו לאכול? לא? טוב, לפחות דיברת איתי. זה יותר ממה שהעירייה עושה.',
    'המזרן שלי פה, על הדשא. נוף לגינה, קרוב לתחבורה ציבורית. מתווך היה גובה על זה 6,000.',
  ] });

  /* Side road and southern blocks */
  b.vroad(19, 24, 45, 1, 1);
  b.fill(22, 24, 23, 1, Tile.Sidewalk);
  b.building({ id: 'ns-s1', x: 22, y: 25, w: 11, h: 12, wall: WallStyle.Plaster, sign: { text: 'מאפיית אינג׳רה', color: '#854d0e', x: 3, w: 4 } });
  b.building({ id: 'ns-s2', x: 33, y: 25, w: 12, h: 12, wall: WallStyle.White });
  b.fill(45, 24, 15, 13, Tile.Concrete);
  for (let x = 46; x < 59; x += 3) b.set(x, 25, Tile.Parking, 0);
  b.prop('carV', 46, 25);
  b.prop('carV', 55, 25, { color: '#8a1f25' });
  b.prop('policeCar', 49, 30, { name: 'הניידת' });
  b.facility('f-exit-ns', 'exit', 'ניידת', 52.5, 30.6, DIR_LEFT);
  b.prop('lamp', 45, 33);
  b.prop('lamp', 58, 28);
  b.hroad(39, 22, 59, 1, 1);
  b.prop('car', 30, 39);
  b.prop('car', 50, 39, { variant: 1 });
  b.label(36, 39.8, 'רחוב הגדוד העברי');
  b.building({ id: 'ns-b1', x: 22, y: 42, w: 19, h: 4, wall: WallStyle.Brick });
  b.building({ id: 'ns-b2', x: 41, y: 42, w: 19, h: 4, wall: WallStyle.Plaster });
  b.npc({ x: 25.5, y: 38.5, dir: DIR_RIGHT, name: 'גברת כהן', role: 'תושבת ותיקה', look: look('female', '#f3d2b3', 'bun', '#bdb6ad', 'blazer', '#6b5a4a', '#3b3a36', { glasses: true }), lines: RESIDENT_LINES, path: [{ x: 23.5, y: 38.5 }, { x: 44.5, y: 38.5 }], speed: 0.6 });
  void DIR_UP;

  return b.build({
    id: 'neveShaanan',
    name: 'נווה שאנן',
    district: 'דרום תל אביב',
    description: 'מדרחוב צפוף, חנויות סלולר, מסעדות אריתראיות ומשרדי העברת כספים.',
    ambient: 'street',
    spawn: { x: 52.5, y: 32.5 },
    darkness: 0.56,
    rain: true,
  });
}
