import { MapBuilder, look } from '../builder';
import { RESIDENT_LINES, STREET_LINES, VENDOR_LINES } from '../lines';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../person';

export function buildLevinsky() {
  const b = new MapBuilder('levinsky', 64, 48);
  b.fill(0, 0, 64, 48, Tile.Concrete);

  /* Back alley behind the shops */
  b.building({ id: 'lev-back', x: 0, y: 0, w: 20, h: 3, wall: WallStyle.Brick, roof: '#5b524a' });
  b.fill(0, 3, 20, 5, Tile.Concrete);
  b.fill(3, 5, 6, 2, Tile.Dirt);
  b.prop('dumpster', 1, 3);
  b.prop('trash', 6, 3);
  b.prop('trash', 8, 3);
  b.prop('crate', 12, 3);
  b.prop('crate', 13, 3);
  b.prop('barrel', 18, 3);
  b.prop('mattress', 14, 5);
  b.prop('puddle', 3, 6);
  b.prop('scooter', 17, 6);
  b.prop('graffiti', 9, 1);
  b.prop('graffiti', 2, 1);
  b.prop('cctvCam', 15, 1, { examine: 'מצלמה שבורה. העדשה מנופצת, החוטים חתוכים.' });
  b.anchor('lev-alley-bin', 7.5, 4.5, DIR_DOWN);
  b.light(10, 4, 3.5, '#ffd98a', 0.6);
  b.label(9, 7.4, 'סמטה אחורית');

  /* Cafe */
  b.building({ id: 'lev-cafe', x: 0, y: 8, w: 11, h: 10, wall: WallStyle.Plaster, floor: FloorStyle.Wood, doors: [5], sideDoors: [{ x: 3, y: 8 }], sign: { text: 'קפה לוינסקי', color: '#7c2d12', x: 2, w: 3 } });
  b.prop('counter', 2, 11, { w: 3, color: '#5b3a24', name: 'דלפק הקפה', examine: 'דלפק עם מכונת אספרסו איטלקית ישנה ומגש בורקסים.' });
  b.prop('coffee', 6, 10);
  b.prop('fridge', 9, 9);
  b.prop('cafeTable', 2, 14);
  b.prop('cafeTable', 5, 14);
  b.prop('cafeTable', 8, 13);
  b.prop('plant', 1, 9);
  b.label(5.5, 9.4, 'בית קפה', 'room', 'lev-cafe');
  b.anchor('lev-cafe-dvr', 8.5, 9.6, DIR_DOWN);
  b.npc({ x: 3.5, y: 10.5, dir: DIR_DOWN, name: 'מורן', role: 'בריסטה', look: look('female', '#e5b48f', 'bun', '#6b4423', 'apron', '#1f2a3a'), lines: [
    'הפוך? שחור? אצלנו גם הפוך יוצא שחור, זה הקפה.',
    'מאז השוד אנשים פה מדברים רק על זה. כולם פתאום בלשים.',
    'שמעון מהחלפנות שותה פה כל בוקר. הבוקר ההוא - הוא לא הגיע.',
    'קפה ב-14 שקל. כן, אני יודעת. גם אני לא קונה פה.',
    'מישהו הזמין פה פעם "פלאט וייט על חלב שיבולת שועל בלי קצף". הבעלים עדיין בטיפול.',
  ] });
  b.npc({ x: 6.5, y: 13.5, dir: DIR_LEFT, name: 'לקוח קבוע', role: 'פנסיונר', look: look('male', '#c98f66', 'bald', '#bdb6ad', 'blazer', '#3b3a36'), lines: RESIDENT_LINES });

  /* Exchange office: crime scene */
  b.building({ id: 'lev-exchange', x: 11, y: 8, w: 9, h: 10, wall: WallStyle.Stone, floor: FloorStyle.Tile, doors: [3], sideDoors: [{ x: 16, y: 8 }], sign: { text: 'חלפנות לוינסקי', color: '#065f46', x: 1, w: 4 } });
  b.hwall(12, 12, 7, WallStyle.Stone);
  b.door(17, 12, FloorStyle.Tile, WallStyle.Stone);
  b.prop('counter', 12, 13, { w: 3, color: '#3d4a5a', name: 'דלפק החלפנות', examine: 'דלפק עם זכוכית משוריינת. בפינה - מכונת ספירת שטרות ופנקס קבלות.' });
  b.prop('safe', 18, 9, { examine: 'הכספת פתוחה לרווחה. המגירות ריקות. ליד הציר - שריטה טרייה.' });
  b.prop('cabinet', 12, 9);
  b.prop('stain', 14, 10);
  b.prop('cctvCam', 13, 8, { examine: 'מצלמת אבטחה פנימית. הכבל שלה נותק מבפנים.' });
  b.anchor('lev-exchange-back', 15.5, 10.5, DIR_DOWN);
  b.anchor('lev-exchange-owner', 16.5, 14.5, DIR_DOWN);
  b.label(15.5, 9.4, 'החדר האחורי', 'room', 'lev-exchange');
  b.label(15.5, 13.4, 'חלפנות', 'room', 'lev-exchange');

  /* The market lane */
  b.fill(20, 0, 6, 18, Tile.Sidewalk, 1);
  const awnings = ['#b91c1c', '#1d4ed8', '#15803d', '#b45309', '#7c3aed', '#be185d'];
  [2, 5, 8, 11, 14].forEach((y, i) => {
    b.prop('stall', 20, y, { color: awnings[i % awnings.length], variant: i % 4 });
    b.prop('stall', 24, y, { color: awnings[(i + 3) % awnings.length], variant: i === 1 ? 0 : (i + 2) % 4 });
    b.light(22.9, y + 1, 2.6, '#ffd27a', 0.55);
  });
  b.prop('sacks', 20, 3, { color: '#ca8a04' });
  b.prop('sacks', 25, 6, { color: '#c2410c' });
  b.prop('sacks', 20, 9, { color: '#7c2d12' });
  b.prop('crate', 25, 12);
  b.prop('crate', 25, 15);
  b.anchor('lev-spice', 23.5, 6.5, DIR_LEFT);
  b.anchor('lev-notes', 23.5, 13.4, DIR_UP);
  b.label(22.9, 0.8, 'שוק לוינסקי');
  b.npc({ x: 21.5, y: 3.6, dir: DIR_RIGHT, name: 'מוטי', role: 'מוכר פיצוחים', look: look('male', '#c98f66', 'short', '#3b2618', 'tshirt', '#2f5d50', '#22252b', { beard: true }), lines: VENDOR_LINES });
  b.npc({ x: 21.5, y: 12.6, dir: DIR_RIGHT, name: 'חנה', role: 'מוכרת פירות יבשים', look: look('female', '#e5b48f', 'curly', '#16120f', 'apron', '#9f1239'), lines: VENDOR_LINES.slice(1) });
  b.npc({ x: 23.5, y: 15.5, dir: DIR_UP, name: 'קונה בשוק', role: 'עוברת אורח', look: look('female', '#9c6644', 'long', '#16120f', 'tshirt', '#6b4a7a'), lines: STREET_LINES, path: [{ x: 22.5, y: 16.5 }, { x: 22.5, y: 1.5 }], speed: 0.8 });

  /* North side of Levinsky street */
  b.building({ id: 'lev-spices', x: 26, y: 4, w: 10, h: 14, wall: WallStyle.Plaster, sign: { text: 'תבלינים ופיצוחים', color: '#92400e', x: 3, w: 4 } });
  b.building({ id: 'lev-bakery', x: 36, y: 4, w: 9, h: 14, wall: WallStyle.White, floor: FloorStyle.Terrazzo, doors: [4], sign: { text: 'מאפיית השוק', color: '#78350f', x: 1, w: 3 } });
  b.prop('counter', 37, 12, { w: 4, color: '#6b4a30', name: 'דלפק המאפייה', examine: 'מגשי בורקס, סמבוסק וג׳חנון. הכל טרי מארבע לפנות בוקר.' });
  b.prop('bookshelf', 37, 6, { name: 'מדף לחמים', examine: 'כיכרות לחם, חלות ובייגלה ירושלמי.' });
  b.prop('bookshelf', 41, 6, { name: 'מדף לחמים', examine: 'פיתות, לאפות ובגטים.' });
  b.prop('sacks', 43, 9, { color: '#e7e5e4', name: 'שקי קמח', examine: 'שקי קמח של עשרים וחמישה קילו.' });
  b.anchor('lev-baker', 39.5, 11.4, DIR_DOWN);
  b.anchor('lev-baker-wife', 41.5, 13.5, DIR_LEFT);
  b.anchor('lev-bakery-store', 43.5, 6.6, DIR_UP);
  b.prop('stain', 42, 5, { name: 'סימני פיח', examine: 'הקיר מושחר מעשן. ריח של קמח שרוף עדיין באוויר.' });
  b.label(40.5, 5.4, 'מאפייה', 'room', 'lev-bakery');
  b.building({ id: 'lev-apts', x: 45, y: 4, w: 19, h: 14, wall: WallStyle.Pink });
  b.building({ id: 'lev-top', x: 26, y: 0, w: 38, h: 4, wall: WallStyle.Plaster, windows: false });

  /* Levinsky street */
  b.hroad(20, 0, 63, 2, 2);
  b.crosswalkH(22, 20, 4);
  b.crosswalkH(56, 20, 4);
  b.prop('car', 3, 20);
  b.prop('car', 28, 20, { variant: 1 });
  b.prop('car', 41, 20);
  b.prop('car', 8, 22, { variant: 1 });
  b.prop('car', 33, 22);
  b.prop('van', 47, 22, { color: '#e2e8f0', name: 'טנדר חלוקה', examine: 'טנדר של ספק ירקות. הנהג אוכל סביח בתוך התא.' });
  [3, 16, 31, 44, 59].forEach((x) => b.prop('lamp', x, 18));
  [9, 27, 39, 53].forEach((x) => b.prop('lamp', x, 25));
  [2, 18, 30, 47, 61].forEach((x) => b.prop('tree', x, 25));
  b.prop('busStop', 34, 25);
  b.prop('hydrant', 12, 25);
  b.prop('plasticChair', 12, 20);
  b.npc({ x: 12.5, y: 18.6, dir: DIR_DOWN, name: 'משה מקומה 3', role: 'שומר על החניה', look: look('male', '#c98f66', 'short', '#8d877f', 'tshirt', '#e7e5e4', '#3b3a36', { glasses: true }), lines: [
    'זה המקום שלי. ארבע עשרה שנה. יש לי טאבו. בערך.',
    '{אתה רוצה|את רוצה} לחנות פה? {תדבר|תדברי} עם הכיסא.',
    'פעם אחת הזיזו לי את הכיסא. פעם אחת. תשאלו את השכנים מה קרה אחר כך.',
    'העירייה אומרת שאסור לשמור חניה. העירייה לא גרה פה.',
  ] });
  b.prop('cat', 36, 24, { color: '#c2410c', name: 'חתול ג׳ינג׳י', examine: 'חתול ג׳ינג׳י. אולי זה שמשון מהמודעה בתחנת האוטובוס? הוא לא מאשר ולא מכחיש.' });
  b.prop('cat', 10, 5, { color: '#1f1f23' });
  b.prop('trash', 6, 18);
  b.prop('manhole', 14, 22);
  b.label(12, 22, 'רחוב לוינסקי');
  b.npc({ x: 5.5, y: 19.6, dir: DIR_RIGHT, name: 'שליח', role: 'שליח וולט', look: look('male', '#9c6644', 'short', '#16120f', 'hoodie', '#0e7490'), lines: STREET_LINES, path: [{ x: 1.5, y: 19.6 }, { x: 62.5, y: 19.6 }], speed: 1.4 });
  b.npc({ x: 40.5, y: 24.6, dir: DIR_LEFT, name: 'עוברת אורח', role: 'תושבת', look: look('female', '#f3d2b3', 'ponytail', '#a8743f', 'leather', '#1c1c1c'), lines: STREET_LINES, path: [{ x: 62.5, y: 24.6 }, { x: 1.5, y: 24.6 }], speed: 1.1 });
  b.anchor('lev-night-cleaner', 37.5, 25.6, DIR_LEFT);

  /* Garden and falafel stand */
  b.fill(0, 26, 22, 12, Tile.Grass);
  b.fill(0, 31, 22, 1, Tile.Sidewalk, 1);
  b.fill(10, 26, 1, 12, Tile.Sidewalk, 1);
  [[2, 27], [6, 28], [16, 27], [20, 29], [3, 35], [18, 36], [7, 34]].forEach(([x, y]) => b.prop('tree', x, y));
  b.prop('bench', 12, 27);
  b.prop('bench', 3, 32);
  b.prop('bench', 13, 35);
  b.prop('stall', 13, 29, { color: '#ca8a04', variant: 2, name: 'דוכן הפלאפל של אבוטבול', examine: 'סיר שמן רותח, כדורי פלאפל וסלטים בקערות פח. ריח של שום.' });
  b.prop('cafeTable', 17, 32);
  b.prop('cafeTable', 14, 33);
  b.light(14, 29, 3.2, '#ffcf70', 0.7);
  b.anchor('lev-falafel', 15.5, 29.6, DIR_LEFT);
  b.label(5, 30.4, 'גינת לוינסקי');
  b.npc({ x: 5.5, y: 32.5, dir: DIR_LEFT, name: 'סבא יצחק', role: 'יושב על הספסל כל יום', look: look('male', '#e5b48f', 'bald', '#bdb6ad', 'blazer', '#4a3426', '#3b3a36', { glasses: true }), lines: [
    'שישים שנה אני על הספסל הזה. ראיתי את השוק כשהיה בו רק שלושה דוכנים.',
    'בבוקר השוד ראיתי אופנוע עומד ליד הסמטה. בלי לוחית. אמרתי לעצמי - לא טוב.',
    'הצעירים היום רצים. אני יושב ורואה הכל.',
    'אני בפנסיה. התפקיד שלי עכשיו: לשבת פה ולהגיד "פעם זה היה אחרת". {תשאל|תשאלי} אותי משהו.',
    'פעם עם שקל היית קונה פלאפל, קולה ומקבל עודף. היום עם שקל {אתה|את} {מקבל|מקבלת} מבט.',
  ] });
  b.npc({ x: 9.5, y: 31.5, dir: DIR_RIGHT, name: 'אמא עם עגלה', role: 'תושבת', look: look('female', '#c98f66', 'long', '#3b2618', 'tshirt', '#3d6b8a'), lines: RESIDENT_LINES, path: [{ x: 1.5, y: 31.5 }, { x: 21.5, y: 31.5 }], speed: 0.8 });

  /* Building in the middle and the parking lot */
  b.building({ id: 'lev-mid', x: 22, y: 27, w: 17, h: 10, wall: WallStyle.Plaster, sign: { text: 'מכולת השוק', color: '#1e3a5f', x: 6, w: 3 } });
  b.fill(39, 26, 25, 12, Tile.Concrete);
  for (let x = 40; x < 63; x += 3) b.set(x, 27, Tile.Parking, 0);
  b.prop('carV', 41, 27);
  b.prop('carV', 44, 27);
  b.prop('carV', 50, 27, { color: '#1d1f23' });
  b.prop('carV', 59, 27);
  b.prop('policeCar', 52, 32, { name: 'הניידת' });
  b.facility('f-exit-lev', 'exit', 'ניידת', 55.5, 32.6, DIR_LEFT);
  b.prop('lamp', 40, 34);
  b.prop('lamp', 62, 30);
  b.label(51, 36.4, 'חניון');

  /* Southern street and buildings */
  b.hroad(39, 0, 63, 1, 1);
  b.prop('car', 8, 39);
  b.prop('car', 30, 39, { variant: 1 });
  b.prop('car', 47, 39);
  b.label(30, 39.8, 'רחוב צ׳לנוב');
  b.building({ id: 'lev-s1', x: 0, y: 42, w: 16, h: 6, wall: WallStyle.Brick });
  b.building({ id: 'lev-s2', x: 16, y: 42, w: 14, h: 6, wall: WallStyle.Plaster });
  b.building({ id: 'lev-s3', x: 30, y: 42, w: 18, h: 6, wall: WallStyle.White });
  b.building({ id: 'lev-s4', x: 48, y: 42, w: 16, h: 6, wall: WallStyle.Stone });
  [12, 36, 56].forEach((x) => b.prop('lamp', x, 41));

  return b.build({
    id: 'levinsky',
    name: 'שוק לוינסקי',
    district: 'דרום תל אביב',
    description: 'דוכני תבלינים, פיצוחים וחלפנויות. סמטאות צפופות וריח של הל וקפה.',
    ambient: 'street',
    spawn: { x: 53.5, y: 34.5 },
    darkness: 0.5,
    rain: false,
  });
}
