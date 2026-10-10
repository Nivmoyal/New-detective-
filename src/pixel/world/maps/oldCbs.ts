import { MapBuilder, look } from '../builder';
import { talk } from '../personas';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../person';

export function buildOldCbs() {
  const b = new MapBuilder('oldCbs', 58, 46);
  b.fill(0, 0, 58, 46, Tile.Concrete);
  const C = WallStyle.Concrete;

  /* The great concrete hall */
  b.building({ id: 'cbs-hall', x: 1, y: 1, w: 56, h: 20, wall: C, floor: FloorStyle.Concrete, doors: [8, 27, 28, 46], roof: '#56595d', lights: '#c9d3b2', sign: { text: 'התחנה המרכזית הישנה', color: '#1f2937', x: 17, w: 7 } });
  b.label(29, 2.4, 'אולם הרציפים העליון', 'room', 'cbs-hall');

  // Gambling den in the corner.
  b.vwall(11, 2, 7, C);
  b.hwall(2, 9, 10, C);
  b.door(7, 9, FloorStyle.Wood, C);
  b.fill(2, 2, 9, 7, Tile.Floor, FloorStyle.Wood);
  b.prop('pokerTable', 3, 4);
  b.prop('pokerTable', 6, 6);
  b.prop('cabinet', 10, 2);
  b.prop('crate', 2, 7);
  b.prop('stain', 5, 7);
  b.prop('chair', 3, 5);
  b.prop('chair', 5, 4);
  b.prop('sign', 3, 9, { w: 3, text: 'מועדון חברים', color: '#4c1d95', name: 'מועדון חברים', examine: 'שלט מודפס: "מועדון חברים - כניסה לחברים בלבד". מאחוריו - משרד הימורים פיראטי.' });
  b.anchor('cbs-gambling', 8.5, 3.5, DIR_DOWN);
  b.label(6.5, 2.4, 'משרד ההימורים', 'room', 'cbs-hall');

  // Shuttered shops along the north wall.
  for (let x = 13; x < 54; x += 4) b.prop(x % 8 === 5 ? 'shutter' : 'graffiti', x, 1, { w: 2 });
  b.prop('poster', 19, 1);
  b.prop('poster', 35, 1);
  for (const x of [16, 24, 32, 40, 48]) for (const y of [6, 13]) b.prop('pillar', x, y);
  b.prop('bench', 19, 10);
  b.prop('bench', 27, 10);
  b.prop('bench', 35, 10);
  b.prop('counter', 41, 15, { w: 3, color: '#57534e', name: 'קיוסק נטוש', examine: 'קיוסק נטוש. על הדלפק עדיין מחירון משנת 2009.' });
  b.prop('crate', 44, 15);
  b.anchor('cbs-callcenter', 42.5, 16.5, DIR_UP);
  b.prop('mattress', 50, 4);
  b.prop('cardboard', 52, 4);
  b.prop('mattress', 51, 8);
  b.prop('barrel', 54, 3, { name: 'חבית עם אש', examine: 'חבית עם שאריות של מדורה. עדיין חמה.' });
  b.light(54.5, 3, 3.5, '#f97316', 0.9);
  b.prop('trash', 30, 17);
  b.prop('cat', 47, 9, { color: '#d6d3d1' });
  b.prop('cat', 26, 31, { color: '#1f1f23' });
  b.prop('puddle', 22, 15);
  b.prop('scooter', 37, 17);
  b.npc({ x: 52.5, y: 6.5, dir: DIR_LEFT, name: 'ז׳ורא', role: 'חי בתחנה', look: look('male', '#f3d2b3', 'short', '#8d877f', 'leather', '#3b3a36', '#2d3440', { beard: true }), lines: [
    'פעם היו פה אלף אוטובוסים ביום. היום - רק אנחנו והחתולים.',
    'החניון למטה? {אל תרד|אל תרדי} לשם בלילה. אנשים נכנסים ולא יוצאים באותו מצב.',
    'השומר יודע הכל. הוא רואה את כל מי שנכנס ויוצא במצלמות.',
    'פה זה כמו מלון. בלי מגבות, בלי צוות, בלי חדרים. אבל עם הרבה היסטוריה.',
  ] });
  b.npc({ x: 24.5, y: 12.5, dir: DIR_RIGHT, name: 'אמנית רחוב', role: 'מציירת גרפיטי', look: look('female', '#c98f66', 'ponytail', '#7a2e1a', 'hoodie', '#4c1d95'), lines: ['הקירות פה הם הגלריה הכי גדולה בעיר. והיחידה בלי כרטיס כניסה.', 'אני מציירת פה בלילות. אף אחד לא מפריע. חוץ ממך, עכשיו.', 'העירייה צובעת מעל, אני מציירת מחדש. זה שיתוף פעולה, הם פשוט עוד לא יודעים.'], path: [{ x: 18.5, y: 12.5 }, { x: 38.5, y: 12.5 }], speed: 0.7 });

  /* Bus platforms */
  b.fill(0, 21, 41, 13, Tile.Concrete);
  b.fill(0, 25, 41, 4, Tile.Asphalt);
  for (let x = 0; x < 41; x++) {
    b.set(x, 24, Tile.Platform, 0);
    b.set(x, 29, Tile.Platform, 1);
  }
  b.prop('bus', 5, 25, { name: 'אוטובוס נטוש' });
  b.prop('busStop', 13, 22);
  b.prop('busStop', 25, 22);
  b.prop('busStop', 16, 30);
  b.prop('busStop', 30, 30);
  for (const x of [9, 21, 33]) b.prop('pillar', x, 22);
  for (const x of [5, 24, 37]) b.prop('pillar', x, 31);
  b.prop('mattress', 35, 32);
  b.prop('trash', 11, 31);
  b.label(20, 27, 'רציפים 1-4');
  b.npc({ x: 27.5, y: 32.5, dir: DIR_UP, name: 'נוסע אבוד', role: 'מחפש את הקו לבת ים', look: look('male', '#9c6644', 'short', '#16120f', 'blazer', '#2d3440', '#2d3440', { glasses: true }), lines: ['סליחה, מאיפה יוצא הקו לבת ים? אמרו לי מפה...', 'מה זאת אומרת סגור מ-2016? בגוגל מפות זה עוד פתוח!', 'טוב, אני אחכה עוד קצת. אולי הם יפתחו מחדש.'] });

  /* Parking and guard booth */
  b.fill(41, 21, 17, 15, Tile.Concrete);
  for (let y = 23; y < 35; y += 3) b.set(42, y, Tile.Parking, 1);
  b.building({ id: 'cbs-booth', x: 49, y: 21, w: 6, h: 5, wall: WallStyle.White, floor: FloorStyle.Lino, doors: [2], sign: { text: 'ביטחון', color: '#1e3a8a', x: 3, w: 2 } });
  b.prop('cctvBox', 49, 26, { name: 'עמדת המצלמות של החניון', examine: 'שש מצלמות על מסך אחד. אחת מהן מכוונת לרמפה לקומות הנטושות.' });
  b.anchor('cbs-guard', 50.5, 26.7, DIR_DOWN);
  // Places reserved for generated cases (see services/caseGenerator.ts).
  b.anchor('gen-cbs-a-scene', 20.5, 4.5, DIR_DOWN);
  b.anchor('gen-cbs-a-w1', 28.5, 8.5, DIR_DOWN);
  b.anchor('gen-cbs-a-w2', 36.5, 4.5, DIR_DOWN);
  b.anchor('gen-cbs-a-cam', 44.5, 9.5, DIR_DOWN);
  b.anchor('gen-cbs-a-alibi', 12.5, 15.5, DIR_DOWN);
  b.anchor('gen-cbs-b-scene', 36.5, 26.5, DIR_DOWN);
  b.anchor('gen-cbs-b-w1', 20.5, 23.5, DIR_DOWN);
  b.anchor('gen-cbs-b-w2', 21.5, 31.5, DIR_DOWN);
  b.anchor('gen-cbs-b-cam', 48.5, 33.5, DIR_DOWN);
  b.anchor('gen-cbs-b-alibi', 3.5, 22.5, DIR_DOWN);
  b.prop('carV', 43, 23);
  b.prop('carV', 43, 29, { color: '#1d1f23' });
  b.prop('van', 46, 31, { color: '#1e3a8a', name: 'טנדר כחול חונה', examine: 'טנדר כחול מאובק. הלוחית שייכת לחברת השכרה.' });
  b.fill(53, 27, 5, 8, Tile.Asphalt);
  b.label(55.5, 30, 'רמפה לחניון התחתון');
  b.prop('fence', 55, 26);
  b.prop('lamp', 51, 33);
  b.prop('lamp', 41, 27);

  /* Street */
  b.fill(0, 34, 41, 2, Tile.Sidewalk);
  b.hroad(37, 0, 57, 2, 1);
  b.prop('policeCar', 3, 34, { name: 'הניידת' });
  b.facility('f-exit-cbs', 'exit', 'ניידת', 6.5, 34.6, DIR_RIGHT);
  b.prop('car', 15, 37);
  b.prop('car', 33, 39, { variant: 1 });
  b.prop('car', 48, 37);
  [10, 22, 34].forEach((x) => b.prop('lamp', x, 35));
  [18, 40].forEach((x) => b.prop('lamp', x, 41));
  b.label(26, 38.9, 'רחוב הגדוד העברי');
  b.building({ id: 'cbs-s1', x: 0, y: 42, w: 20, h: 4, wall: WallStyle.Plaster });
  b.building({ id: 'cbs-s2', x: 20, y: 42, w: 20, h: 4, wall: WallStyle.Brick });
  b.building({ id: 'cbs-s3', x: 40, y: 42, w: 18, h: 4, wall: WallStyle.Concrete });
  b.npc({ x: 20.5, y: 36.5, dir: DIR_LEFT, name: 'עובר אורח', look: look('male', '#c98f66', 'curly', '#3b2618', 'tshirt', '#2b2b2e'), ...talk('street', false), path: [{ x: 1.5, y: 36.5 }, { x: 56.5, y: 36.5 }], speed: 1.1 });
  void DIR_UP;

  return b.build({
    id: 'oldCbs',
    name: 'התחנה המרכזית הישנה',
    district: 'דרום תל אביב',
    description: 'רציפים נטושים, עמודי בטון וחניון תת קרקעי. מקום שבו אף אחד לא שואל שאלות.',
    ambient: 'street',
    spawn: { x: 8.5, y: 35.3 },
    darkness: 0.62,
    rain: true,
  });
}
