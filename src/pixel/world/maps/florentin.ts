import { MapBuilder, look } from '../builder';
import { NIGHT_LINES, RESIDENT_LINES, STREET_LINES } from '../lines';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../sprites';

export function buildFlorentin() {
  const b = new MapBuilder('florentin', 58, 46);
  b.fill(0, 0, 58, 46, Tile.Concrete);

  /* Back alley */
  b.building({ id: 'fl-north', x: 0, y: 0, w: 39, h: 3, wall: WallStyle.Brick, roof: '#4f4740' });
  b.fill(0, 3, 39, 3, Tile.Concrete);
  for (const x of [1, 6, 12, 17, 28, 33]) b.prop('graffiti', x, 1, { w: 2 });
  b.prop('dumpster', 2, 3);
  b.prop('dumpster', 14, 3);
  b.prop('trash', 20, 3);
  b.prop('crate', 33, 3);
  b.prop('crate', 34, 3);
  b.prop('puddle', 8, 4);
  b.prop('stain', 26, 5, { name: 'סימני גרירה', examine: 'שני פסים כהים על האספלט, נקטעים בבת אחת ליד שפת המדרכה.' });
  b.anchor('fl-backdoor', 25.5, 4.4, DIR_DOWN);
  b.anchor('fl-smoker', 30.5, 4.4, DIR_LEFT);
  b.light(24.5, 5, 3, '#fde68a', 0.6);
  b.label(9, 5.5, 'סמטה אחורית');

  /* The Bunker club */
  b.building({ id: 'fl-club', x: 0, y: 6, w: 36, h: 21, wall: WallStyle.Club, floor: FloorStyle.Club, doors: [18], sideDoors: [{ x: 24, y: 6 }], roof: '#2b2a30', lights: '#c084fc', sign: { text: 'הבונקר', color: '#e11d48', neon: true, x: 20, w: 5 } });
  b.prop('graffiti', 3, 25, { w: 2 });
  b.prop('graffiti', 9, 25, { w: 2 });
  b.prop('poster', 13, 26);
  b.prop('poster', 27, 26);
  b.prop('graffiti', 30, 25, { w: 2 });
  // Office.
  b.vwall(10, 7, 6, WallStyle.Club);
  b.hwall(1, 13, 10, WallStyle.Club);
  b.door(5, 13, FloorStyle.Wood, WallStyle.Club);
  b.fill(1, 7, 9, 6, Tile.Floor, FloorStyle.Wood);
  b.prop('desk', 2, 9, { variant: 1, name: 'שולחן ההנהלה', examine: 'שולחן עם ערימת חשבוניות ספקים ובקבוק וויסקי חצי ריק.' });
  b.prop('safe', 9, 7);
  b.prop('cabinet', 1, 7);
  b.prop('sofa', 2, 11, { color: '#1f1f23' });
  b.anchor('fl-office-dvr', 7.5, 9.5, DIR_DOWN);
  b.label(5.5, 7.4, 'משרד ההנהלה', 'room', 'fl-club');
  // Storage.
  b.vwall(28, 7, 6, WallStyle.Club);
  b.hwall(28, 13, 7, WallStyle.Club);
  b.door(31, 13, FloorStyle.Concrete, WallStyle.Club);
  b.fill(29, 7, 6, 6, Tile.Floor, FloorStyle.Concrete);
  b.prop('crate', 29, 8);
  b.prop('crate', 30, 8);
  b.prop('barrel', 34, 8);
  b.prop('crate', 33, 11);
  b.prop('evidenceShelf', 29, 11, { name: 'מדף בקבוקים', examine: 'ארגזי וודקה, קרטוני בירה וחביות לחץ.' });
  b.label(31.5, 7.4, 'מחסן', 'room', 'fl-club');
  // Dance floor and DJ.
  b.fill(12, 8, 15, 11, Tile.Dance);
  b.prop('djBooth', 18, 7);
  b.prop('speaker', 12, 7);
  b.prop('speaker', 26, 7);
  b.light(15, 11, 3.2, '#ec4899', 0.85, 'fl-club');
  b.light(23, 11, 3.2, '#22d3ee', 0.85, 'fl-club');
  b.light(19, 16, 3.2, '#a3e635', 0.7, 'fl-club');
  // Bar.
  b.prop('counter', 1, 17, { w: 9, color: '#3f1d2b', name: 'הבר', examine: 'בר ארוך. מתחת לדלפק - קופסת טיפים וערימת צ׳ייסרים.' });
  b.prop('fridge', 1, 14);
  b.prop('fridge', 8, 14);
  for (const x of [2, 4, 6, 8]) b.prop('stool', x, 18);
  b.anchor('fl-bar', 5.5, 16.4, DIR_DOWN);
  b.label(5, 14.4, 'בר', 'room', 'fl-club');
  // Lounge.
  b.prop('sofa', 28, 16, { color: '#4c1d95' });
  b.prop('sofa', 31, 16, { color: '#4c1d95' });
  b.prop('cafeTable', 29, 19);
  b.prop('cafeTable', 32, 19);
  b.prop('rug', 27, 21, { w: 7, h: 2, color: '#1e1b2e' });
  b.npc({ x: 15.5, y: 13.5, dir: DIR_RIGHT, name: 'רוקדת', role: 'באה כל סוף שבוע', look: look('female', '#f3d2b3', 'long', '#a8743f', 'tshirt', '#be185d'), lines: NIGHT_LINES, path: [{ x: 14.5, y: 13.5 }, { x: 24.5, y: 12.5 }], speed: 0.5 });
  b.npc({ x: 21.5, y: 10.5, dir: DIR_DOWN, name: 'רוקד', role: 'סטודנט', look: look('male', '#e5b48f', 'curly', '#16120f', 'tshirt', '#7c3aed'), lines: NIGHT_LINES.slice(1) });
  b.npc({ x: 30.5, y: 18.5, dir: DIR_LEFT, name: 'מירי', role: 'מלצרית', look: look('female', '#c98f66', 'ponytail', '#16120f', 'tshirt', '#0f0f10'), lines: [
    'נועה? היא עבדה איתנו בבר בסופי שבוע. היא מצחיקה, חכמה. לא נעלמת סתם.',
    'עידן, הבעלים, היה עצבני כל הלילה ההוא. הלך ובא מהמשרד.',
    ...NIGHT_LINES.slice(3),
  ] });

  /* Side alley */
  b.fill(36, 3, 3, 24, Tile.Concrete);
  b.prop('trash', 38, 10);
  b.prop('scooter', 36, 14);
  b.prop('cardboard', 37, 20);
  b.prop('lamp', 38, 7);

  /* Workshop, courtyard, grocery and apartments */
  b.building({ id: 'fl-work', x: 39, y: 0, w: 19, h: 11, wall: WallStyle.Concrete, sign: { text: 'נגריית פלורנטין', color: '#57534e', x: 4, w: 5 } });
  b.fill(39, 11, 19, 3, Tile.Concrete);
  b.prop('crate', 41, 11);
  b.prop('scooter', 45, 12);
  b.prop('scooter', 46, 12);
  b.prop('barrel', 56, 11);
  b.building({ id: 'fl-grocery-b', x: 39, y: 14, w: 9, h: 13, wall: WallStyle.Plaster, floor: FloorStyle.Lino, doors: [3], sign: { text: 'מכולת 24/7', color: '#15803d', x: 5, w: 3 } });
  b.prop('fridge', 40, 15);
  b.prop('fridge', 41, 15);
  b.prop('fridge', 42, 15);
  b.prop('bookshelf', 40, 19, { name: 'מדף מצרכים', examine: 'במבה, ביסלי, פסטה ושימורים. מחירים של תל אביב.' });
  b.prop('counter', 44, 21, { w: 3, color: '#3d4a5a', name: 'קופה', examine: 'קופה רושמת, סיגריות מאחורי הדלפק וקופסת לוטו.' });
  b.prop('cctvBox', 46, 16, { name: 'מסך המצלמה של המכולת' });
  b.anchor('fl-grocery', 45.5, 20.4, DIR_DOWN);
  b.label(43.5, 15.4, 'מכולת', 'room', 'fl-grocery-b');
  b.building({ id: 'fl-apts', x: 48, y: 14, w: 10, h: 13, wall: WallStyle.Brick });
  b.prop('graffiti', 50, 25, { w: 2 });

  /* Washington street */
  b.hroad(29, 0, 57, 1, 2);
  b.crosswalkH(18, 29, 2);
  b.prop('car', 4, 29);
  b.prop('car', 26, 29, { variant: 1, color: '#1d1f23' });
  b.prop('car', 40, 29, { color: '#f5f5f4', name: 'מונית', examine: 'מונית עם שלט צהוב על הגג. המונה כבוי.' });
  b.prop('car', 43, 29, { color: '#f5f5f4', name: 'מונית', examine: 'מונית ריקה. בתא הכפפות - מפה מקופלת של גוש דן.' });
  b.anchor('fl-taxi', 46.5, 31.6, DIR_UP);
  b.label(44, 32.6, 'תחנת מוניות');
  [6, 20, 33, 52].forEach((x) => b.prop('lamp', x, 27));
  [12, 28, 48].forEach((x) => b.prop('lamp', x, 32));
  b.label(10, 30, 'רחוב וושינגטון');
  b.npc({ x: 16.5, y: 27.6, dir: DIR_DOWN, name: 'הסלקטור התורן', role: 'מאבטח בכניסה', look: look('male', '#9c6644', 'bald', '#16120f', 'tshirt', '#0f0f10', '#17191d', { beard: true }), lines: [
    'אתה ברשימה? לא? אז אתה שוטר. תיכנס.',
    'קובי? הוא לא במשמרת היום. אחרי מה שקרה, נתנו לו כמה ימים.',
    'אני רואה כל מי שנכנס. מי שיוצא מאחור - זה כבר לא אצלי.',
  ] });
  b.npc({ x: 8.5, y: 28.5, dir: DIR_RIGHT, name: 'עוברת אורח', role: 'בדרך למסיבה', look: look('female', '#e5b48f', 'bun', '#16120f', 'leather', '#1c1c1c'), lines: NIGHT_LINES, path: [{ x: 1.5, y: 28.5 }, { x: 56.5, y: 28.5 }], speed: 1.1 });
  b.npc({ x: 30.5, y: 31.5, dir: DIR_LEFT, name: 'עובר אורח', role: 'תושב השכונה', look: look('male', '#e5b48f', 'short', '#16120f', 'hoodie', '#24324a'), lines: STREET_LINES, path: [{ x: 56.5, y: 31.5 }, { x: 1.5, y: 31.5 }], speed: 1 });

  /* Florentin square */
  b.fill(0, 33, 32, 9, Tile.Sidewalk, 1);
  b.fill(4, 35, 8, 5, Tile.Grass);
  b.fill(18, 35, 8, 5, Tile.Grass);
  [[6, 36], [10, 38], [20, 36], [24, 38]].forEach(([x, y]) => b.prop('tree', x, y));
  b.prop('bench', 13, 35);
  b.prop('bench', 13, 39);
  b.prop('stall', 27, 34, { color: '#0f766e', variant: 2, name: 'קיוסק מיצים', examine: 'קיוסק מיצים טבעיים. סגור בשעה הזאת.' });
  b.prop('cafeTable', 28, 37);
  b.prop('cafeTable', 30, 39);
  b.prop('lamp', 16, 37);
  b.label(16, 34, 'כיכר פלורנטין');
  b.npc({ x: 14.5, y: 36.5, dir: DIR_DOWN, name: 'סבתא רחל', role: 'גרה מעל המכולת', look: look('female', '#f3d2b3', 'curly', '#bdb6ad', 'blazer', '#6b5a4a', '#3b3a36', { glasses: true }), lines: [
    'המוזיקה מהבונקר לא נותנת לישון. כל לילה.',
    'בלילה ההוא שמעתי צעקה מהסמטה. אחר כך דלת של אוטו. אחר כך שקט.',
    ...RESIDENT_LINES.slice(0, 2),
  ] });
  b.fill(32, 33, 26, 9, Tile.Concrete);
  for (let x = 33; x < 57; x += 3) b.set(x, 34, Tile.Parking, 0);
  b.prop('carV', 34, 34);
  b.prop('carV', 40, 34, { color: '#5a2d4a' });
  b.prop('policeCar', 49, 37, { name: 'הניידת' });
  b.facility('f-exit-fl', 'exit', 'ניידת', 52.5, 37.6, DIR_LEFT);
  b.prop('lamp', 45, 40);
  b.building({ id: 'fl-s1', x: 0, y: 42, w: 22, h: 4, wall: WallStyle.Brick });
  b.building({ id: 'fl-s2', x: 22, y: 42, w: 18, h: 4, wall: WallStyle.Plaster });
  b.building({ id: 'fl-s3', x: 40, y: 42, w: 18, h: 4, wall: WallStyle.Pink });
  void DIR_UP;

  return b.build({
    id: 'florentin',
    name: 'פלורנטין - רחוב וושינגטון',
    district: 'דרום תל אביב',
    description: 'מועדון מחתרתי ברחוב וושינגטון. גרפיטי על הקירות, בס כבד ויציאה אחורית לסמטה.',
    ambient: 'club',
    spawn: { x: 51.5, y: 39.5 },
    darkness: 0.66,
    rain: false,
  });
}
