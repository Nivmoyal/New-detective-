import { MapBuilder, look } from '../builder';
import { personaLines, talk } from '../personas';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../person';

export function buildShapira() {
  const b = new MapBuilder('shapira', 58, 46);
  b.fill(0, 0, 58, 46, Tile.Grass);

  /* Houses with yards */
  b.building({ id: 'sh-brodsky', x: 2, y: 1, w: 11, h: 8, wall: WallStyle.Stone, floor: FloorStyle.Wood, doors: [5], roof: '#8a6a52', sign: { text: 'ברודסקי', color: '#44403c', x: 7, w: 2 } });
  b.prop('sofa', 3, 2, { color: '#4b5563' });
  b.prop('table', 7, 3);
  b.prop('bookshelf', 10, 2);
  b.prop('rug', 3, 4, { w: 3, h: 2, color: '#7f1d1d' });
  b.label(7.5, 2.4, 'בית משפחת ברודסקי', 'room', 'sh-brodsky');
  b.fill(1, 9, 13, 4, Tile.Grass);
  b.fill(7, 9, 1, 5, Tile.Dirt);
  b.prop('lemonTree', 3, 10);
  b.prop('lemonTree', 11, 10);
  for (let x = 1; x < 14; x++) if (x !== 7) b.prop('fence', x, 13);
  b.anchor('sh-brodsky-yard', 9.5, 11.5, DIR_DOWN);
  b.anchor('sh-neighbor', 8.5, 14.6, DIR_DOWN);

  b.building({ id: 'sh-h2', x: 15, y: 2, w: 12, h: 7, wall: WallStyle.Plaster, roof: '#7d6f60' });
  b.fill(15, 9, 12, 4, Tile.Grass);
  b.prop('lemonTree', 17, 10);
  b.prop('tree', 24, 11);
  b.prop('bench', 19, 11);
  for (let x = 15; x < 27; x++) if (x !== 21) b.prop('fence', x, 13);
  b.npc({ x: 20.5, y: 10.5, dir: DIR_DOWN, name: 'שושנה', role: 'שכנה', look: look('female', '#c98f66', 'bun', '#bdb6ad', 'tshirt', '#7c2d12', '#3b3a36'), lines: [
    'גלינה מסכנה. מאז שאלכס השתחרר, כל פעם שמשהו קורה - באים אליהם.',
    'אלכס עובד אצל המוסכניק ברחוב הבא. ילד טוב עכשיו, באמת.',
    ...personaLines('resident', true),
  ] });

  b.building({ id: 'sh-rent', x: 29, y: 1, w: 12, h: 8, wall: WallStyle.White, floor: FloorStyle.Tile, doors: [6], roof: '#6b6f73', sign: { text: 'להשכרה', color: '#b45309', x: 2, w: 2 } });
  b.prop('table', 31, 3);
  b.prop('crate', 37, 2);
  b.prop('crate', 38, 2);
  b.prop('mattress', 37, 5);
  b.label(35, 2.4, 'דירה שכורה', 'room', 'sh-rent');
  b.anchor('sh-roommate', 34.5, 4.6, DIR_DOWN);
  b.fill(29, 9, 12, 4, Tile.Dirt);
  b.prop('scooter', 31, 10);
  b.prop('trash', 39, 11);

  b.building({ id: 'sh-shul', x: 43, y: 1, w: 14, h: 9, wall: WallStyle.Stone, roof: '#8a8174', sign: { text: 'בית כנסת שפירא', color: '#1e3a5f', x: 4, w: 5 } });
  b.fill(43, 10, 14, 3, Tile.Sidewalk, 1);
  b.prop('bench', 45, 11);
  b.prop('bench', 52, 11);
  b.anchor('sh-victim', 47.5, 10.6, DIR_DOWN);
  b.npc({ x: 49.5, y: 11.5, dir: DIR_DOWN, name: 'הגבאי', role: 'גבאי בית הכנסת', look: look('male', '#e5b48f', 'short', '#bdb6ad', 'suit', '#17191d', '#17191d', { beard: true, glasses: true }), lines: [
    '{אם אתה עשירי - בוא, בבקשה. אנחנו תשעה כבר שעה.|חבל שאת לא יכולה להיות עשירית. אנחנו תשעה כבר שעה.}',
    'בבית הכנסת הזה יש שלושה גבאים, ארבעה מתפללים ושני ועדים. אבל קידוש - יש תמיד.',
    'בשכונה הזאת כולם מכירים את כולם. מי שלא מכיר - שואל אותי.',
    'המחסנים ברחוב? חצי מהם של אנשים מבחוץ. באים בלילה, יוצאים בלילה.',
  ] });
  [13, 14, 27, 28, 41, 42].forEach((x) => b.fill(x, 0, 1, 14, Tile.Dirt));

  /* Mesilat Yesharim street */
  b.hroad(16, 0, 57, 1, 2);
  [4, 18, 32, 46].forEach((x) => b.prop('lamp', x, 14));
  [11, 25, 39, 53].forEach((x) => b.prop('lamp', x, 19));
  b.prop('car', 6, 16);
  b.prop('car', 22, 16, { variant: 1 });
  b.prop('car', 36, 16, { color: '#3d5a3a' });
  b.prop('tree', 8, 19);
  b.prop('tree', 30, 19);
  b.label(18, 17, 'רחוב מסילת ישרים');
  b.npc({ x: 10.5, y: 15.6, dir: DIR_RIGHT, name: 'עובר אורח', look: look('male', '#9c6644', 'buzz', '#16120f', 'vest', '#3f3f46'), ...talk('street', false), path: [{ x: 1.5, y: 15.6 }, { x: 56.5, y: 15.6 }], speed: 1.1 });

  /* Storage units */
  b.fill(0, 20, 58, 12, Tile.Concrete);
  b.building({ id: 'sh-storage', x: 3, y: 20, w: 42, h: 8, wall: WallStyle.Concrete, roof: '#5f6266', windows: false });
  for (let i = 0; i < 6; i++) {
    const x = 5 + i * 7;
    b.prop('storageDoor', x, 27, { name: `מחסן ${i + 1}`, examine: i === 3 ? 'מחסן 4. מנעול תלייה חדש לגמרי, מבריק, על דלת ישנה וחלודה.' : 'דלת גלילה של מחסן, נעולה במנעול תלייה.' });
    b.prop('storageDoor', x + 1, 27, { name: `מחסן ${i + 1}` });
    b.prop('sign', x, 26, { w: 2, text: `מחסן ${i + 1}`, color: '#334155', name: `מחסן ${i + 1}` });
  }
  b.anchor('sh-storage4', 26.5, 28.5, DIR_UP);
  // Places reserved for generated cases (see services/caseGenerator.ts).
  b.anchor('gen-sh-a-scene', 12.5, 30.5, DIR_DOWN);
  b.anchor('gen-sh-a-w1', 19.5, 29.5, DIR_DOWN);
  b.anchor('gen-sh-a-w2', 42.5, 30.5, DIR_DOWN);
  b.anchor('gen-sh-a-cam', 54.5, 27.5, DIR_DOWN);
  b.anchor('gen-sh-a-alibi', 2.5, 24.5, DIR_DOWN);
  b.anchor('gen-sh-b-scene', 20.5, 36.5, DIR_DOWN);
  b.anchor('gen-sh-b-w1', 9.5, 39.5, DIR_DOWN);
  b.anchor('gen-sh-b-w2', 52.5, 34.5, DIR_DOWN);
  b.anchor('gen-sh-b-cam', 25.5, 14.6, DIR_DOWN);
  b.anchor('gen-sh-b-alibi', 40.5, 37.5, DIR_DOWN);
  b.prop('van', 34, 29, { color: '#e2e8f0', name: 'טנדר', examine: 'טנדר לבן עם ארגזי קרטון מאחור. על הדלת מדבקה של חברת הנהלת חשבונות.' });
  b.prop('barrel', 3, 29);
  b.prop('trash', 15, 29);
  b.prop('lamp', 10, 30);
  b.prop('lamp', 40, 30);
  b.label(23, 30.6, 'מחסנים להשכרה');
  b.prop('policeCar', 48, 23, { name: 'הניידת' });
  b.facility('f-exit-sh', 'exit', 'ניידת', 51.5, 23.6, DIR_LEFT);
  b.prop('carV', 54, 21, { color: '#2d3a4d' });
  b.npc({ x: 7.5, y: 29.5, dir: DIR_UP, name: 'שמעון', role: 'שומר המחסנים', look: look('male', '#c98f66', 'short', '#8d877f', 'vest', '#1e3a8a', '#2d3440', { cap: false }), lines: [
    'אני שומר פה ביום. בלילה - אין אף אחד. רק מצלמה אחת, וגם היא לא עובדת.',
    'בלי צו אני לא פותח לאף אחד. גם לא למשטרה. זה החוק.',
    'מחסן 4? השוכר בא רק בלילות. בחור לבוש יפה, עם משקפיים.',
    'בעשרים שנה פה ראיתי הכל: מחסן של שטיחים, מחסן של חשבוניות, ומחסן אחד של תרנגולות. לא שואלים.',
  ] });

  b.prop('cat', 20, 12, { color: '#3f3f46' });
  b.prop('cat', 40, 31, { color: '#c2410c' });

  /* Public garden */
  b.fill(0, 32, 58, 1, Tile.Sidewalk);
  b.fill(0, 38, 58, 1, Tile.Dirt);
  b.fill(28, 33, 1, 13, Tile.Dirt);
  [[3, 34], [9, 36], [15, 34], [20, 41], [34, 35], [40, 41], [48, 34], [54, 40], [5, 43]].forEach(([x, y]) => b.prop('tree', x, y));
  b.prop('lemonTree', 24, 35);
  b.prop('sandbox', 44, 40);
  b.prop('bench', 30, 36);
  b.prop('bench', 30, 41);
  b.prop('bench', 12, 40);
  b.prop('lamp', 27, 37);
  b.prop('lamp', 13, 37);
  b.label(36, 39, 'גינת שפירא');
  b.npc({ x: 31.5, y: 37.3, dir: DIR_DOWN, name: 'דודה רינה', look: look('female', '#9c6644', 'curly', '#3b2618', 'blazer', '#7c2d12', '#3b3a36'), ...talk('resident', true) });
  b.npc({ x: 46.5, y: 38.5, dir: DIR_LEFT, name: 'ילד מהשכונה', role: 'משחק כדור', look: look('male', '#c98f66', 'short', '#16120f', 'tshirt', '#15803d', '#2d3440'), lines: ['{אתה שוטר אמיתי|את שוטרת אמיתית}? איפה האקדח? איפה הניידת? למה {אתה הולך|את הולכת} ברגל?', 'אמא שלי אומרת לא לדבר עם זרים. אבל שוטר זה לא זר, נכון? נכון?!', 'כשאני אהיה גדול אני אהיה שוטר. או יוטיובר. עוד לא החלטתי.'], path: [{ x: 36.5, y: 38.5 }, { x: 56.5, y: 38.5 }], speed: 1.6 });
  void DIR_RIGHT;

  return b.build({
    id: 'shapira',
    name: 'שכונת שפירא',
    district: 'דרום תל אביב',
    description: 'בתים נמוכים, חצרות עם עצי לימון ומחסנים מושכרים לאורך הרחוב.',
    ambient: 'street',
    spawn: { x: 50.5, y: 25.5 },
    darkness: 0.5,
    rain: false,
  });
}
