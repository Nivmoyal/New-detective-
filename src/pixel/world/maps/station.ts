import { DESK_SERGEANT, MENTOR } from '../../../data/characters';
import { MapBuilder, look } from '../builder';
import { COP_LINES } from '../lines';
import { FloorStyle, Tile, WallStyle } from '../types';
import { DIR_DOWN, DIR_LEFT, DIR_RIGHT, DIR_UP } from '../../sprites';

export function buildStation() {
  const b = new MapBuilder('station', 46, 37);
  const S = WallStyle.Station;
  b.fill(0, 0, 46, 37, Tile.Grass);
  b.fill(0, 25, 46, 6, Tile.Concrete);
  b.fill(1, 1, 44, 1, Tile.Sidewalk);
  b.fill(0, 1, 2, 24, Tile.Sidewalk);
  b.fill(44, 1, 2, 24, Tile.Sidewalk);

  // The station building.
  b.building({ id: 'station', x: 2, y: 2, w: 42, h: 23, wall: S, floor: FloorStyle.Lino, doors: [20, 21], roof: '#5d6166', sign: { text: 'משטרת ישראל - תחנת שרפשטיין', color: '#1e3a8a', x: 15, w: 4 } });
  // Room partitions.
  b.hwall(3, 10, 40, S);
  b.hwall(3, 13, 40, S);
  b.vwall(12, 3, 7, S);
  b.vwall(31, 3, 7, S);
  b.vwall(10, 14, 9, S);
  b.vwall(16, 14, 9, S);
  b.vwall(30, 14, 9, S);
  b.vwall(36, 14, 9, S);
  // Floors.
  b.fill(3, 3, 9, 7, Tile.Floor, FloorStyle.Wood);
  b.fill(13, 3, 18, 7, Tile.Floor, FloorStyle.Carpet);
  b.fill(32, 3, 11, 7, Tile.Floor, FloorStyle.Lab);
  b.fill(3, 11, 40, 2, Tile.Floor, FloorStyle.Lino);
  b.fill(3, 14, 7, 9, Tile.Floor, FloorStyle.Concrete);
  b.fill(11, 14, 5, 9, Tile.Floor, FloorStyle.Concrete);
  b.fill(17, 14, 13, 9, Tile.Floor, FloorStyle.Terrazzo);
  b.fill(31, 14, 5, 9, Tile.Floor, FloorStyle.Checker);
  b.fill(37, 14, 6, 9, Tile.Floor, FloorStyle.Concrete);
  // Doors and the open lobby.
  b.door(8, 10, FloorStyle.Wood, S);
  b.door(17, 10, FloorStyle.Carpet, S);
  b.door(26, 10, FloorStyle.Carpet, S);
  b.door(36, 10, FloorStyle.Lab, S);
  b.door(4, 13, FloorStyle.Concrete, S);
  b.door(13, 13, FloorStyle.Concrete, S);
  b.door(33, 13, FloorStyle.Checker, S);
  b.door(39, 13, FloorStyle.Concrete, S);
  b.fill(21, 13, 5, 1, Tile.Floor, FloorStyle.Terrazzo);

  // Room labels (visible inside).
  b.label(7.5, 3.4, 'משרד המפקדת', 'room', 'station');
  b.label(22, 3.4, 'משרד חוקרים', 'room', 'station');
  b.label(37.5, 3.4, 'מעבדת מז״פ', 'room', 'station');
  b.label(6.5, 14.4, 'חדר חקירות', 'room', 'station');
  b.label(13.5, 14.4, 'תצפית', 'room', 'station');
  b.label(23.5, 14.4, 'לובי ודלפק', 'room', 'station');
  b.label(33.5, 14.4, 'מטבחון', 'room', 'station');
  b.label(40, 14.4, 'חדר ראיות', 'room', 'station');

  /* Commander's office */
  b.prop('policeBadge', 6, 2);
  b.prop('window', 10, 2, { variant: 1 });
  b.prop('window', 4, 2, { variant: 1 });
  b.prop('bookshelf', 3, 3);
  b.prop('desk', 5, 5, { variant: 1, name: 'שולחן המפקדת', examine: 'שולחן מסודר להפליא. תיקייה אחת פתוחה: דו״ח פשיעה רבעוני של מרחב יפתח.' });
  b.prop('chair', 5, 6);
  b.prop('chair', 6, 6);
  b.prop('rug', 4, 7, { w: 4, h: 2, color: '#3b2a4a' });
  b.prop('plant', 11, 3);
  b.prop('sofa', 9, 8, { color: '#3f2a1d' });
  b.prop('cabinet', 11, 5);
  b.facility('f-commander', 'commander', 'משרד המפקד', 7.5, 5.5, DIR_DOWN);

  /* Investigators' office */
  b.prop('whiteboard', 14, 2);
  b.prop('corkboard', 19, 2);
  b.prop('clock', 23, 2);
  b.prop('window', 25, 2, { variant: 1 });
  b.prop('window', 28, 2, { variant: 1 });
  b.prop('desk', 14, 4, { variant: 0, name: 'השולחן של יוסי כהן', examine: 'שולחן של חוקר ותיק: מאפרה ריקה, תמונה מהטקס של 1998, וערימת תיקים סגורים.' });
  b.prop('chair', 14, 5);
  b.prop('desk', 18, 4, { variant: 1 });
  b.prop('chair', 18, 5);
  b.prop('desk', 22, 4, { variant: 1, name: 'עמדת מודיעין', examine: 'שני מסכים עם מפות אנטנות סלולריות ורשימות שיחות.' });
  b.prop('chair', 22, 5);
  b.prop('desk', 14, 7, { variant: 2 });
  b.prop('chair', 14, 8);
  b.prop('desk', 18, 7, { variant: 0 });
  b.prop('chair', 18, 8);
  b.prop('desk', 26, 7, { variant: 1, name: 'השולחן שלך', facility: 'f-desk', examine: 'השולחן שלך. תיקי החקירה הפתוחים מונחים עליו.' });
  b.facility('f-desk', 'desk', 'השולחן שלך ולוח הראיות', 27, 7.5, DIR_DOWN, true);
  b.prop('chair', 26, 8);
  b.prop('pinboard', 28, 7, { name: 'לוח הראיות שלך', facility: 'f-desk' });
  b.prop('copier', 30, 3);
  b.prop('cabinet', 13, 3);
  b.prop('plant', 30, 9);
  b.prop('cooler', 24, 9);
  b.anchor('st-intel-desk', 24.5, 4.5, DIR_LEFT);
  b.anchor('st-records-terminal', 29.5, 5.5, DIR_DOWN);
  b.npc({ id: 'npc-mentor', x: 16.5, y: 5.5, dir: DIR_DOWN, name: MENTOR.name, role: MENTOR.role, look: MENTOR.look, lines: [
    'טיפ ממני: אל תחברו ללוח שום דבר שלא בדקתם עד הסוף. כל חוט אדום שקורס בפרקליטות - חוזר אליכם.',
    'אליבי טוב שווה זהב. הוא לא רק מנקה חשוד - הוא מצמצם לכם את הרשימה.',
    'בחדר החקירות, לחץ בלי ראיות זה רק רעש. קודם מניחים את הראיה על השולחן, אחר כך לוחצים.',
    'מז״פ זה לא פורמליות. ראיה פיזית שלא עברה מעבדה - לא קיימת מבחינת הלוח.',
    'אף אחד פה לא יגיד לך מאיפה להתחיל. השטח פתוח. תבחר תיק, תבחר רחוב, ותתחיל לדבר עם אנשים.',
  ] });

  /* Forensic lab */
  b.prop('window', 34, 2, { variant: 1 });
  b.prop('window', 40, 2, { variant: 1 });
  b.prop('labBench', 33, 4);
  b.prop('labBench', 37, 4);
  b.prop('labBench', 33, 7);
  b.prop('cabinet', 42, 3);
  b.prop('fridge', 42, 8, { name: 'מקרר דגימות', examine: 'מקרר דגימות נעול. מדבקה: "ביולוגי - לא לאוכל!".' });
  b.prop('terminal', 37, 8);
  b.facility('f-lab', 'lab', 'מעבדת מז"פ', 40.5, 6.5, DIR_LEFT);

  /* Corridor */
  b.prop('corkboard', 19, 10);
  b.prop('poster', 30, 10);
  b.prop('clock', 12, 10);
  b.prop('plant', 3, 11);
  b.prop('plant', 42, 11);
  b.prop('bench', 28, 11);
  b.prop('cooler', 10, 11);
  b.facility('f-interrogation', 'interrogation', 'חדר חקירות באזהרה', 6.5, 12.5, DIR_DOWN);
  b.npc({ x: 40.5, y: 12.5, dir: DIR_LEFT, name: 'רס״ר דודי אוחנה', role: 'שוטר סיור', look: look('male', '#c98f66', 'buzz', '#16120f', 'uniform', '#8fb0d4', '#1d2633'), lines: COP_LINES, path: [{ x: 40.5, y: 12.5 }, { x: 12.5, y: 12.5 }], speed: 1.2 });

  /* Interrogation + observation */
  b.prop('mirror', 6, 13);
  b.prop('interrogationTable', 5, 17);
  b.prop('chair', 5, 16);
  b.prop('chair', 6, 18);
  b.prop('cctvCam', 9, 13);
  b.prop('desk', 11, 16, { variant: 0, name: 'עמדת תצפית', examine: 'מסך שמשדר את חדר החקירות ומקליט דיגיטלי עם נורה אדומה.' });
  b.prop('chair', 12, 17);
  b.prop('cabinet', 15, 14);

  /* Lobby */
  b.prop('corkboard', 17, 13);
  b.prop('poster', 27, 13);
  b.prop('counter', 20, 17, { w: 5, color: '#33465e', name: 'דלפק קבלה', examine: 'דלפק הקבלה. ספר תלונות פתוח ופעמון שאף אחד לא עונה לו.' });
  b.prop('bench', 17, 21);
  b.prop('bench', 27, 21);
  b.prop('plant', 29, 15);
  b.prop('plant', 17, 15);
  b.anchor('st-lobby-bench', 19.5, 20.5, DIR_LEFT);
  b.npc({ id: 'npc-sergeant', x: 22.5, y: 16.5, dir: DIR_DOWN, name: DESK_SERGEANT.name, role: DESK_SERGEANT.role, look: DESK_SERGEANT.look, lines: [
    'בוקר. הקפה במטבחון, המעלית לא עובדת, ומישהו שוב החנה על המקום של המפקדת.',
    'שמעתי שקיבלת תיקים כבר ביום הראשון. המפקדת לא עושה את זה לכל אחד.',
    'אם אתם יוצאים לשטח, ליאת מחכה בניידת בחניון. היא מכירה כל סמטה בדרום העיר.',
    'מתלוננת חיכתה פה שלוש שעות בגלל אופניים גנובים. ככה זה תחנה.',
  ] });
  b.npc({ x: 25.5, y: 20.5, dir: DIR_UP, name: 'אזרח ממתין', role: 'בא להגיש תלונה', look: look('male', '#e5b48f', 'bald', '#bdb6ad', 'tshirt', '#4b5a6b'), lines: [
    'גנבו לי את האופניים מהחצר. כבר שלוש שעות אני מחכה פה.',
    'אתה חוקר? אולי אתה יכול לקחת את התלונה שלי? לא? יופי.',
  ] });

  /* Kitchenette */
  b.prop('counter', 31, 14, { w: 2, color: '#5b4636' });
  b.prop('coffee', 34, 14);
  b.prop('fridge', 35, 17);
  b.prop('table', 32, 18);
  b.prop('chair', 31, 18);
  b.prop('chair', 34, 19);
  b.npc({ x: 31.5, y: 21.5, dir: DIR_UP, name: 'רס״ל מירב לוי', role: 'בלשית בצוות הסמים', look: look('female', '#c98f66', 'ponytail', '#3b2618', 'leather', '#2b2b2e'), lines: COP_LINES.slice(1) });

  /* Evidence room */
  b.prop('evidenceShelf', 37, 18);
  b.prop('evidenceShelf', 40, 18);
  b.prop('evidenceShelf', 37, 21);
  b.prop('evidenceShelf', 40, 21);
  b.prop('counter', 37, 15, { w: 2, color: '#3f4650' });
  b.facility('f-evidence', 'evidenceRoom', 'חדר ראיות', 41.5, 15.5, DIR_LEFT);

  /* Parking and street */
  for (let x = 3; x < 44; x += 3) if (x < 18 || x > 27) b.set(x, 27, Tile.Parking, 0);
  b.prop('policeCar', 4, 27);
  b.prop('policeCar', 8, 27, { variant: 1 });
  b.prop('policeCar', 31, 27);
  b.prop('car', 37, 27, { color: '#2d3a4d' });
  b.prop('car', 40, 29, { color: '#c9c6bd', name: 'הרכב של המפקדת', examine: 'רכב שרד לבן. מישהו חנה ממש צמוד אליו.' });
  b.prop('policeCar', 21, 28, { name: 'הניידת של ליאת' });
  b.facility('f-exit', 'exit', 'ניידת - יציאה לשטח', 24.5, 28.5, DIR_LEFT);
  b.prop('lamp', 2, 25);
  b.prop('lamp', 16, 25);
  b.prop('lamp', 29, 25);
  b.prop('lamp', 43, 25);
  b.prop('tree', 0, 4);
  b.prop('tree', 45, 7);
  b.prop('tree', 0, 16);
  b.prop('tree', 45, 19);
  b.hroad(33, 0, 45, 1, 2);
  b.crosswalkH(22, 33, 2);
  b.prop('car', 6, 33, { variant: 1 });
  b.prop('car', 34, 33);
  b.prop('lamp', 10, 31);
  b.prop('lamp', 36, 31);
  b.prop('tree', 3, 36);
  b.prop('tree', 18, 36);
  b.prop('tree', 30, 36);
  b.prop('trash', 42, 31);
  b.label(14, 34, 'רחוב סלמה');
  b.label(14, 29.6, 'חניון ניידות');
  b.npc({ x: 12.5, y: 32.5, dir: DIR_RIGHT, name: 'עוברת אורח', role: 'תושבת השכונה', look: look('female', '#e5b48f', 'long', '#16120f', 'tshirt', '#6b4a7a'), lines: ['אתם מהתחנה? תגידו להם שהפנס בפינה לא עובד כבר חודש.', 'כל הלילה ניידות. אי אפשר לישון פה.'], path: [{ x: 1.5, y: 32.5 }, { x: 44.5, y: 32.5 }], speed: 1.1 });

  return b.build({
    id: 'station',
    name: 'תחנת שרפשטיין',
    district: 'מרחב יפתח',
    description: 'תחנת המשטרה של דרום תל אביב: משרד המפקדת, משרד החוקרים, מעבדת מז״פ, חדר חקירות וחדר ראיות.',
    ambient: 'station',
    spawn: { x: 23, y: 26.5 },
    darkness: 0.42,
    rain: false,
  });
}
