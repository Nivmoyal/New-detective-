// Pixel-art props: furniture, street furniture, vehicles and wall decorations.
// Every prop can be examined; each type has a few lines of flavor text.
import { hashString, shade } from '../color';
import { T, type Prop } from './types';

type Ctx = CanvasRenderingContext2D;

export interface PropDef {
  w: number;
  h: number;
  solid: boolean;
  /** Painted once into the static ground layer (decals, wall decorations). */
  flat?: boolean;
  /** Drawn on the facade/wall; not y-sorted. */
  wall?: boolean;
  /** Small clutter: only picked when nothing more interesting is in reach. */
  minor?: boolean;
  name: string;
  examine: string[];
  draw: (ctx: Ctx, px: number, py: number, p: Prop, t: number) => void;
}

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function shadow(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

const CAR_COLORS = ['#8a1f25', '#c9c6bd', '#2d3a4d', '#1d1f23', '#6b6f75', '#3d5a3a', '#b48a3c', '#5a2d4a', '#e0ded6'];

function drawCarH(ctx: Ctx, px: number, py: number, body: string, police: boolean, t: number, facingLeft: boolean) {
  // Footprint 3x2 tiles, seen from above at a slight angle: roof on top, the side below.
  const x = px + 2;
  const w = 44;
  const top = py + 6;
  const dark = shade(body, -0.32);
  const side = shade(body, -0.16);
  shadow(ctx, x + 2, top + 21, w, 4);
  // Upper surface: hood, cabin, trunk.
  r(ctx, x + 1, top, w - 2, 12, body);
  r(ctx, x, top + 2, w, 9, body);
  r(ctx, x + 1, top, w - 2, 1, shade(body, 0.3));
  const cab = facingLeft ? x + 15 : x + 11;
  r(ctx, cab, top - 2, 18, 12, police ? '#f4f4f2' : shade(body, 0.1));
  r(ctx, cab, top - 2, 18, 1, shade(body, 0.35));
  // Windshield and rear window.
  const front = facingLeft ? cab - 1 : cab + 15;
  const rear = facingLeft ? cab + 15 : cab - 1;
  r(ctx, front, top - 1, 4, 10, '#1a2532');
  r(ctx, front + 1, top, 1, 3, '#5f7891');
  r(ctx, rear, top, 4, 8, '#1a2532');
  // Side: doors, windows, wheels.
  r(ctx, x, top + 11, w, 9, side);
  r(ctx, x, top + 19, w, 2, dark);
  r(ctx, cab + 1, top + 11, 16, 3, '#1a2532');
  r(ctx, cab + 9, top + 11, 1, 8, dark);
  r(ctx, cab + 6, top + 15, 2, 1, shade(body, 0.3));
  r(ctx, cab + 13, top + 15, 2, 1, shade(body, 0.3));
  for (const wx of [x + 5, x + w - 13]) {
    r(ctx, wx, top + 17, 8, 5, '#0d0e11');
    r(ctx, wx + 2, top + 18, 4, 3, '#3a3d44');
    r(ctx, wx + 3, top + 19, 2, 1, '#8a8f99');
  }
  // Lights.
  const fx = facingLeft ? x : x + w - 2;
  const bx = facingLeft ? x + w - 2 : x;
  r(ctx, fx, top + 12, 2, 3, '#f8eab0');
  r(ctx, bx, top + 12, 2, 3, '#c0262d');
  if (police) {
    r(ctx, x + 1, top + 15, w - 2, 2, '#1d4ed8');
    r(ctx, x + 1, top + 17, w - 2, 1, '#93c5fd');
    r(ctx, cab + 2, top + 4, 14, 2, '#d8dde3');
    const on = Math.floor(t * 3) % 2 === 0;
    r(ctx, cab + 3, top + 1, 6, 3, on ? '#60a5fa' : '#1e3a8a');
    r(ctx, cab + 9, top + 1, 6, 3, on ? '#7f1d1d' : '#f87171');
  }
}

function drawCarV(ctx: Ctx, px: number, py: number, body: string) {
  // Footprint 2x3 tiles, nose facing down.
  const x = px + 5;
  const w = 22;
  const y = py + 2;
  const dark = shade(body, -0.32);
  shadow(ctx, x + 2, y + 6, w, 40);
  r(ctx, x, y, w, 38, body);
  r(ctx, x + 1, y, w - 2, 1, shade(body, 0.3));
  r(ctx, x + 3, y + 10, w - 6, 16, shade(body, 0.1));
  r(ctx, x + 3, y + 7, w - 6, 4, '#1a2532');
  r(ctx, x + 3, y + 25, w - 6, 4, '#1a2532');
  r(ctx, x + 5, y + 26, 3, 1, '#5f7891');
  // Front face.
  r(ctx, x, y + 38, w, 6, shade(body, -0.18));
  r(ctx, x + 1, y + 39, 4, 2, '#f8eab0');
  r(ctx, x + w - 5, y + 39, 4, 2, '#f8eab0');
  r(ctx, x + 7, y + 40, 8, 2, dark);
  r(ctx, x - 1, y + 40, 3, 5, '#0d0e11');
  r(ctx, x + w - 2, y + 40, 3, 5, '#0d0e11');
  r(ctx, x - 1, y + 6, 2, 6, '#0d0e11');
  r(ctx, x + w - 1, y + 6, 2, 6, '#0d0e11');
  r(ctx, x + 2, y, 3, 1, '#c0262d');
  r(ctx, x + w - 5, y, 3, 1, '#c0262d');
}

function pick<T>(p: Prop, arr: T[]): T {
  return arr[hashString(p.id) % arr.length];
}

/* ------------------------------------------------------------------ */

export const PROPS: Record<string, PropDef> = {
  /* ---------------- Office & station ---------------- */
  desk: {
    w: 2, h: 1, solid: true, name: 'שולחן עבודה',
    examine: ['ערימת תיקים, כוס קפה קרה ומדבקות צהובות עם מספרי טלפון.', 'שולחן עמוס טפסים. על אחד מהם כתוב בטוש: "לא לגעת - בטיפול".', 'מקלדת שחוקה, עט לעיסה, ותמונה של ילדים בחוף הים.'],
    draw(ctx, px, py, p) {
      shadow(ctx, px + 1, py + 12, 31, 3);
      r(ctx, px, py + 2, 32, 9, '#5a3f2a');
      r(ctx, px, py + 2, 32, 1, '#7a5a3e');
      r(ctx, px + 1, py + 11, 30, 3, '#3f2c1d');
      r(ctx, px + 2, py + 11, 3, 4, '#2c1f15');
      r(ctx, px + 27, py + 11, 3, 4, '#2c1f15');
      if ((p.variant ?? 0) !== 2) {
        r(ctx, px + 11, py - 5, 11, 8, '#16191f');
        r(ctx, px + 12, py - 4, 9, 6, (p.variant ?? 0) === 1 ? '#264a6e' : '#1e3a2f');
        r(ctx, px + 13, py - 3, 5, 1, '#7dd3fc');
        r(ctx, px + 15, py + 3, 3, 1, '#16191f');
        r(ctx, px + 10, py + 5, 12, 3, '#2a2d33');
      }
      r(ctx, px + 2, py + 3, 6, 5, '#e8e4d8');
      r(ctx, px + 3, py + 4, 4, 1, '#9aa3ad');
      r(ctx, px + 25, py + 4, 3, 3, '#f1f1f1');
      r(ctx, px + 26, py + 5, 1, 1, '#3b2414');
    },
  },
  chair: {
    w: 1, h: 1, solid: false, minor: true, name: 'כיסא משרדי', examine: ['כיסא משרדי עם גלגל אחד שחורק.', 'כיסא שמישהו שכח עליו מעיל.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 4, py + 12, 9, 2);
      r(ctx, px + 4, py + 1, 8, 6, '#22262e');
      r(ctx, px + 4, py + 7, 8, 4, '#2c313a');
      r(ctx, px + 7, py + 11, 2, 2, '#15171b');
      r(ctx, px + 4, py + 13, 8, 1, '#15171b');
    },
  },
  cabinet: {
    w: 1, h: 1, solid: true, name: 'ארון תיוק', examine: ['ארון תיוק מתכתי. המגירה העליונה נעולה.', 'תיקים ישנים משנות התשעים. מישהו עוד מתייק פה בנייר.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 13, 13, 3);
      r(ctx, px + 2, py - 8, 12, 21, '#6b7280');
      r(ctx, px + 2, py - 8, 12, 1, '#9ca3af');
      for (let i = 0; i < 3; i++) {
        r(ctx, px + 3, py - 6 + i * 7, 10, 1, '#4b5563');
        r(ctx, px + 7, py - 4 + i * 7, 2, 1, '#d1d5db');
      }
    },
  },
  bookshelf: {
    w: 2, h: 1, solid: true, name: 'מדף קלסרים', examine: ['שורות של קלסרים: "נוהלי חקירה", "פקודות מטא״ר", "תיקי 2019".', 'מדף עם ספרי חוק העונשין עמוסי פתקים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 31, 3);
      r(ctx, px + 1, py - 10, 30, 23, '#4a3424');
      const cols = ['#1d4ed8', '#b91c1c', '#d1a54a', '#166534', '#e5e7eb', '#334155'];
      for (let s = 0; s < 3; s++) {
        r(ctx, px + 2, py - 9 + s * 7, 28, 6, '#2a1d14');
        for (let b = 0; b < 9; b++) r(ctx, px + 3 + b * 3, py - 8 + s * 7, 2, 5, cols[(b * 7 + s * 3) % cols.length]);
      }
    },
  },
  table: {
    w: 2, h: 2, solid: true, name: 'שולחן', examine: ['שולחן ישיבות. כתמי קפה בצורת טבעות.', 'שולחן עם מפה של דרום העיר, מסומנת בטושים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 26, 29, 4);
      r(ctx, px + 1, py + 4, 30, 20, '#6b4a30');
      r(ctx, px + 1, py + 4, 30, 1, '#8a6544');
      r(ctx, px + 2, py + 24, 28, 3, '#4a3221');
      r(ctx, px + 6, py + 8, 10, 7, '#d8d2c0');
      r(ctx, px + 7, py + 10, 7, 1, '#7f1d1d');
      r(ctx, px + 20, py + 12, 4, 4, '#f1f1f1');
    },
  },
  sofa: {
    w: 2, h: 1, solid: true, name: 'ספה', examine: ['ספה מרופטת. מישהו ישן עליה במשמרת לילה.', 'ספת עור סדוקה. ריח של סיגריות ישנות.'],
    draw(ctx, px, py, p) {
      const c = p.color ?? '#5e1f26';
      shadow(ctx, px + 1, py + 13, 31, 3);
      r(ctx, px + 1, py - 2, 30, 7, shade(c, -0.2));
      r(ctx, px + 1, py + 5, 30, 8, c);
      r(ctx, px + 1, py + 5, 30, 1, shade(c, 0.2));
      r(ctx, px, py + 1, 3, 12, shade(c, -0.1));
      r(ctx, px + 29, py + 1, 3, 12, shade(c, -0.1));
      r(ctx, px + 16, py + 5, 1, 8, shade(c, -0.3));
    },
  },
  bench: {
    w: 2, h: 1, solid: true, name: 'ספסל', examine: ['ספסל עץ. חרוטים עליו שמות ותאריכים.', 'ספסל ציבורי. מישהו השאיר עליו עיתון של אתמול.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 12, 29, 3);
      r(ctx, px + 2, py + 2, 28, 3, '#7a5537');
      r(ctx, px + 2, py + 6, 28, 3, '#7a5537');
      r(ctx, px + 2, py + 9, 28, 2, '#5e412a');
      r(ctx, px + 4, py + 11, 2, 3, '#2a2a2a');
      r(ctx, px + 26, py + 11, 2, 3, '#2a2a2a');
    },
  },
  plant: {
    w: 1, h: 1, solid: true, name: 'עציץ', examine: ['פיקוס במשרד. השקו אותו בקפה, ונראה שזה עובד.', 'עציץ עם בדלי סיגריות באדמה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 3, py + 13, 11, 2);
      r(ctx, px + 4, py + 7, 8, 6, '#8a4b2a');
      r(ctx, px + 4, py + 7, 8, 1, '#a65f36');
      r(ctx, px + 2, py - 4, 12, 11, '#2f5d2a');
      r(ctx, px + 4, py - 7, 8, 5, '#3c7034');
      r(ctx, px + 5, py - 2, 2, 2, '#4c8a42');
      r(ctx, px + 10, py + 1, 2, 2, '#244a20');
    },
  },
  cooler: {
    w: 1, h: 1, solid: true, name: 'מתקן מים', examine: ['מתקן מים קרים. הבקבוק כמעט ריק.', 'מעל המתקן תלוי שלט: "מי שמסיים - מחליף!".'],
    draw(ctx, px, py) {
      shadow(ctx, px + 3, py + 13, 11, 2);
      r(ctx, px + 4, py - 1, 8, 14, '#d4d7dc');
      r(ctx, px + 5, py - 9, 6, 8, '#7fb7e6');
      r(ctx, px + 6, py - 8, 2, 5, '#b6dcf7');
      r(ctx, px + 6, py + 3, 1, 2, '#2563eb');
      r(ctx, px + 9, py + 3, 1, 2, '#dc2626');
    },
  },
  coffee: {
    w: 1, h: 1, solid: true, name: 'מכונת קפה', examine: ['מכונת קפה שמשמיעה רעש של מטוס. הקפה עצמו - בינוני.', 'פתק על המכונה: "קפסולות על חשבון רס״ב חדד. תודה, ניסים".'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 13, 13, 2);
      r(ctx, px + 1, py + 4, 14, 9, '#5a3f2a');
      r(ctx, px + 4, py - 6, 8, 11, '#1f2125');
      r(ctx, px + 5, py - 5, 6, 3, '#3a3d44');
      r(ctx, px + 6, py + 1, 3, 3, '#f1f1f1');
      r(ctx, px + 10, py - 4, 1, 1, '#22c55e');
    },
  },
  copier: {
    w: 1, h: 1, solid: true, name: 'מדפסת', examine: ['מדפסת משולבת. על המסך: "תקלה E-27". כמו תמיד.', 'ערימת דפים מודפסים שאף אחד לא אסף.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 15, 2);
      r(ctx, px + 1, py - 2, 14, 15, '#c9ccd1');
      r(ctx, px + 1, py - 2, 14, 2, '#e5e7eb');
      r(ctx, px + 3, py + 4, 10, 2, '#4b5563');
      r(ctx, px + 10, py + 1, 3, 1, '#f59e0b');
    },
  },
  fridge: {
    w: 1, h: 1, solid: true, name: 'מקרר משקאות', examine: ['מקרר זכוכית עם פחיות. הזמזום שלו ממלא את החדר.', 'מקרר עם שלט "שתייה קרה 5 ש״ח".'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 13, 13, 2);
      r(ctx, px + 2, py - 12, 12, 25, '#b9bec6');
      r(ctx, px + 3, py - 11, 10, 20, '#1d2f3f');
      for (let s = 0; s < 4; s++)
        for (let i = 0; i < 4; i++) r(ctx, px + 4 + i * 2, py - 10 + s * 5, 1, 3, ['#dc2626', '#f59e0b', '#22c55e', '#e5e7eb'][(i + s) % 4]);
    },
  },
  counter: {
    w: 3, h: 1, solid: true, name: 'דלפק', examine: ['דלפק קבלה. פעמון מתכת ופנקס תורים.', 'דלפק מצופה פורמייקה, שחוק במקום שבו אנשים נשענים.'],
    draw(ctx, px, py, p) {
      const w = p.w * T;
      const c = p.color ?? '#4a3a2c';
      shadow(ctx, px + 1, py + 13, w - 1, 3);
      r(ctx, px, py + 1, w, 6, shade(c, 0.25));
      r(ctx, px, py + 7, w, 7, c);
      r(ctx, px, py + 7, w, 1, shade(c, -0.25));
      for (let x = 6; x < w - 2; x += 12) r(ctx, px + x, py + 9, 4, 3, shade(c, -0.15));
    },
  },
  labBench: {
    w: 2, h: 1, solid: true, name: 'שולחן מעבדה', examine: ['מיקרוסקופ, מבחנות וערכת אבקה לטביעות אצבע.', 'שקיות ראיות מסומנות בברקוד, מחכות לבדיקה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 31, 3);
      r(ctx, px, py + 2, 32, 9, '#e5e7eb');
      r(ctx, px, py + 11, 32, 3, '#9ca3af');
      r(ctx, px + 4, py - 6, 4, 9, '#334155');
      r(ctx, px + 3, py - 7, 6, 2, '#1f2937');
      r(ctx, px + 5, py - 2, 2, 2, '#94a3b8');
      for (let i = 0; i < 4; i++) r(ctx, px + 14 + i * 3, py - 2, 2, 5, ['#60a5fa', '#f87171', '#a3e635', '#fbbf24'][i]);
      r(ctx, px + 13, py + 3, 12, 1, '#6b7280');
      r(ctx, px + 26, py + 3, 4, 5, '#d9c48f');
    },
  },
  evidenceShelf: {
    w: 2, h: 1, solid: true, name: 'מדף ראיות', examine: ['קופסאות ראיות חתומות, כל אחת עם מספר תיק ושרשרת משמורת.', 'שקית עם סכין חלודה מתיק משנת 2011. אף אחד לא בא לקחת.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 31, 3);
      r(ctx, px + 1, py - 10, 30, 23, '#3f4650');
      for (let s = 0; s < 3; s++) {
        r(ctx, px + 1, py - 4 + s * 7, 30, 1, '#6b7280');
        for (let b = 0; b < 4; b++) {
          r(ctx, px + 3 + b * 7, py - 9 + s * 7, 6, 5, '#b08d57');
          r(ctx, px + 4 + b * 7, py - 8 + s * 7, 3, 1, '#f1f1f1');
        }
      }
    },
  },
  lockers: {
    w: 2, h: 1, solid: true, name: 'לוקרים', examine: ['לוקרים של שוטרי הסיור. על אחד מדבקה של בית״ר.', 'לוקר פתוח: מדים מגוהצים ונעליים מצוחצחות.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 31, 3);
      for (let i = 0; i < 4; i++) {
        r(ctx, px + 1 + i * 8, py - 10, 7, 23, '#475569');
        r(ctx, px + 1 + i * 8, py - 10, 7, 1, '#64748b');
        r(ctx, px + 2 + i * 8, py - 7, 5, 1, '#1e293b');
        r(ctx, px + 2 + i * 8, py - 5, 5, 1, '#1e293b');
        r(ctx, px + 6 + i * 8, py + 1, 1, 2, '#cbd5e1');
      }
    },
  },
  interrogationTable: {
    w: 2, h: 1, solid: true, name: 'שולחן חקירות', examine: ['שולחן מתכת מוברג לרצפה. טבעת לאזיקים בצד אחד.', 'מיקרופון קטן מודבק לשולחן. כל מילה מוקלטת.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 12, 29, 3);
      r(ctx, px + 2, py + 2, 28, 9, '#6b7280');
      r(ctx, px + 2, py + 2, 28, 1, '#9ca3af');
      r(ctx, px + 3, py + 11, 26, 2, '#374151');
      r(ctx, px + 15, py + 5, 3, 2, '#111827');
      r(ctx, px + 6, py + 4, 2, 2, '#d1d5db');
    },
  },
  safe: {
    w: 1, h: 1, solid: true, name: 'כספת', examine: ['כספת פלדה כבדה. הדלת שלה פתוחה לרווחה.', 'כספת ישנה עם חוגה מספרית.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 13, 15, 2);
      r(ctx, px + 1, py - 4, 14, 17, '#3f4650');
      r(ctx, px + 1, py - 4, 14, 1, '#6b7280');
      r(ctx, px + 3, py - 2, 10, 13, '#2d333b');
      r(ctx, px + 7, py + 3, 3, 3, '#9ca3af');
    },
  },
  pokerTable: {
    w: 2, h: 1, solid: true, name: 'שולחן קלפים', examine: ['שולחן לבד ירוק עם כתמי בירה. ז׳יטונים פזורים על הרצפה.', 'קלפים מפוזרים, מאפרה מלאה ומגירה שנשלפה בחופזה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 31, 3);
      r(ctx, px + 1, py + 1, 30, 11, '#3b2a1c');
      r(ctx, px + 3, py + 2, 26, 8, '#1f5a35');
      r(ctx, px + 8, py + 4, 3, 4, '#f1f1f1');
      r(ctx, px + 13, py + 5, 3, 4, '#f1f1f1');
      r(ctx, px + 22, py + 5, 2, 2, '#dc2626');
      r(ctx, px + 25, py + 6, 2, 2, '#2563eb');
    },
  },

  /* ---------------- Street ---------------- */
  car: {
    w: 3, h: 2, solid: true, name: 'רכב חונה',
    examine: ['רכב חונה. על השמשה דו״ח חניה מקומט.', 'מכונית עם שריטה ארוכה לאורך הדלת.', 'רכב מאובק. מישהו כתב באצבע "תשטוף אותי".', 'רכב עם מושב ילדים מאחור וכדורגל על הרצפה.'],
    draw(ctx, px, py, p, t) {
      drawCarH(ctx, px, py, p.color ?? pick(p, CAR_COLORS), false, t, (p.variant ?? 0) === 1);
    },
  },
  carV: {
    w: 2, h: 3, solid: true, name: 'רכב חונה',
    examine: ['רכב חונה בחניה. הגלגל הקדמי על המדרכה.', 'רכב מסחרי קטן עם שם של חברת הובלות.'],
    draw(ctx, px, py, p) {
      drawCarV(ctx, px, py, p.color ?? pick(p, CAR_COLORS));
    },
  },
  policeCar: {
    w: 3, h: 2, solid: true, name: 'ניידת משטרה', examine: ['ניידת משטרה. המנוע עדיין חם.', 'ניידת סיור עם פנס כחול-אדום על הגג.'],
    draw(ctx, px, py, p, t) {
      drawCarH(ctx, px, py, '#e7e5df', true, t, (p.variant ?? 0) === 1);
    },
  },
  van: {
    w: 4, h: 2, solid: true, name: 'טנדר', examine: ['טנדר מסחרי עם דלתות אחוריות. על הדופן שם של חברת ניקיון.', 'טנדר ישן. בפנים קרטונים ושמיכה.'],
    draw(ctx, px, py, p) {
      const c = p.color ?? '#9aa3ad';
      const x = px + 2;
      const w = 60;
      const top = py + 3;
      shadow(ctx, x + 2, top + 24, w, 4);
      r(ctx, x, top, w, 14, c);
      r(ctx, x, top, w, 1, shade(c, 0.3));
      r(ctx, x + w - 14, top + 1, 4, 12, '#1a2532');
      r(ctx, x, top + 14, w, 10, shade(c, -0.16));
      r(ctx, x, top + 22, w, 2, shade(c, -0.32));
      r(ctx, x + w - 13, top + 14, 11, 4, '#1a2532');
      r(ctx, x + 6, top + 16, 30, 4, shade(c, -0.25));
      for (const wx of [x + 6, x + w - 15]) {
        r(ctx, wx, top + 20, 9, 6, '#0d0e11');
        r(ctx, wx + 2, top + 21, 5, 4, '#3a3d44');
      }
      r(ctx, x + w - 2, top + 15, 2, 3, '#f8eab0');
      r(ctx, x, top + 15, 2, 3, '#c0262d');
    },
  },
  bus: {
    w: 8, h: 3, solid: true, name: 'אוטובוס נטוש', examine: ['אוטובוס עירוני ישן בלי גלגלים. השלט עוד מראה "קו 4".', 'בפנים מושבים קרועים, שמיכות ובקבוקים ריקים.'],
    draw(ctx, px, py) {
      const x = px + 2;
      const w = 124;
      const top = py + 4;
      shadow(ctx, x + 3, top + 40, w, 5);
      r(ctx, x, top, w, 20, '#d9d2a6');
      r(ctx, x, top, w, 1, '#ece6c2');
      for (let i = 0; i < 4; i++) r(ctx, x + 14 + i * 26, top + 4, 14, 10, '#c6bf92');
      r(ctx, x, top + 20, w, 20, '#c9c08a');
      for (let i = 0; i < 12; i++) r(ctx, x + 6 + i * 10, top + 22, 8, 8, i === 3 ? '#0d1117' : '#1b2633');
      r(ctx, x, top + 32, w, 3, '#3b6ea8');
      r(ctx, x + w - 6, top + 21, 5, 12, '#1b2633');
      r(ctx, x + w - 4, top + 34, 3, 2, '#5c5a4a');
      r(ctx, x + 10, top + 36, 14, 4, '#2a2a2a');
      r(ctx, x + w - 30, top + 36, 14, 4, '#2a2a2a');
      r(ctx, x + 40, top + 26, 16, 2, '#a83232');
    },
  },
  lamp: {
    w: 1, h: 1, solid: true, name: 'פנס רחוב', examine: ['פנס רחוב. נורה צהובה מהבהבת קלות.', 'עמוד תאורה עם מודעות מודבקות: "דירה להשכרה", "שיעורי תופים".'],
    draw(ctx, px, py) {
      shadow(ctx, px + 5, py + 12, 7, 2);
      r(ctx, px + 7, py - 22, 2, 35, '#3a3f46');
      r(ctx, px + 6, py + 9, 4, 4, '#2b2f35');
      r(ctx, px + 7, py - 22, 7, 2, '#3a3f46');
      r(ctx, px + 11, py - 21, 4, 3, '#2b2f35');
      r(ctx, px + 12, py - 19, 2, 1, '#ffe8a3');
    },
  },
  tree: {
    w: 1, h: 1, solid: true, name: 'עץ', examine: ['פיקוס ותיק. השורשים הרימו את המרצפות מסביב.', 'עץ עם עלווה צפופה. ציפורים מצייצות גם בלילה.'],
    draw(ctx, px, py, p) {
      shadow(ctx, px - 4, py + 10, 24, 5);
      r(ctx, px + 6, py - 4, 4, 17, '#4a3221');
      const g = p.color ?? '#2c4a26';
      r(ctx, px - 5, py - 22, 26, 18, g);
      r(ctx, px - 2, py - 26, 20, 4, g);
      r(ctx, px - 7, py - 16, 30, 9, g);
      r(ctx, px - 1, py - 24, 9, 6, shade(g, 0.18));
      r(ctx, px - 4, py - 17, 6, 4, shade(g, 0.12));
      r(ctx, px + 10, py - 12, 10, 4, shade(g, -0.25));
      r(ctx, px + 3, py - 9, 12, 3, shade(g, -0.3));
    },
  },
  palm: {
    w: 1, h: 1, solid: true, name: 'דקל', examine: ['דקל וושינגטוניה גבוה. כמה ענפים יבשים עומדים ליפול.'],
    draw(ctx, px, py) {
      shadow(ctx, px - 2, py + 10, 20, 4);
      for (let i = 0; i < 30; i += 3) r(ctx, px + 6, py + 10 - i, 4, 3, i % 6 ? '#6b5236' : '#5a442c');
      const g = '#3f6b33';
      r(ctx, px - 6, py - 24, 28, 3, g);
      r(ctx, px - 2, py - 28, 20, 4, shade(g, 0.15));
      r(ctx, px - 8, py - 21, 6, 4, shade(g, -0.2));
      r(ctx, px + 18, py - 21, 6, 4, shade(g, -0.2));
      r(ctx, px + 2, py - 30, 12, 3, shade(g, 0.25));
    },
  },
  lemonTree: {
    w: 1, h: 1, solid: true, name: 'עץ לימון', examine: ['עץ לימון בחצר. לימונים על הענפים ועל הרצפה.'],
    draw(ctx, px, py) {
      shadow(ctx, px - 2, py + 10, 20, 4);
      r(ctx, px + 6, py - 2, 3, 15, '#4a3221');
      r(ctx, px - 3, py - 16, 22, 15, '#335a2a');
      r(ctx, px, py - 19, 16, 4, '#3c6b31');
      for (let i = 0; i < 7; i++) r(ctx, px - 1 + ((i * 7) % 18), py - 15 + ((i * 5) % 12), 2, 2, '#f5d742');
    },
  },
  stall: {
    w: 2, h: 1, solid: true, name: 'דוכן בשוק',
    examine: ['דוכן עם שקי יוטה מלאים. הריח חזק.', 'דוכן מכוסה ברזנט. המוכר משחק שש-בש בצד.'],
    draw(ctx, px, py, p) {
      const awn = p.color ?? '#b91c1c';
      shadow(ctx, px, py + 12, 33, 4);
      r(ctx, px + 1, py + 3, 30, 10, '#5a3f2a');
      r(ctx, px + 1, py + 3, 30, 1, '#7a5a3e');
      const v = p.variant ?? 0;
      const goods = v === 0 ? ['#c2410c', '#ca8a04', '#7c2d12', '#a16207', '#dc2626', '#65a30d'] : v === 1 ? ['#a8a29e', '#d6d3d1', '#78716c', '#e7e5e4'] : v === 2 ? ['#dc2626', '#f97316', '#84cc16', '#facc15', '#16a34a'] : ['#1e293b', '#334155', '#94a3b8', '#e2e8f0'];
      for (let i = 0; i < 6; i++) {
        r(ctx, px + 2 + i * 5, py + 4, 4, 4, '#c2a878');
        r(ctx, px + 2 + i * 5, py + 4, 4, 2, goods[i % goods.length]);
        r(ctx, px + 3 + i * 5, py + 3, 2, 1, shade(goods[i % goods.length], 0.25));
      }
      r(ctx, px + 1, py - 10, 2, 13, '#3a3f46');
      r(ctx, px + 29, py - 10, 2, 13, '#3a3f46');
      for (let i = 0; i < 8; i++) r(ctx, px - 1 + i * 4.25, py - 13, 4, 6, i % 2 ? awn : '#e7e5e4');
      r(ctx, px - 1, py - 7, 34, 1, shade(awn, -0.35));
    },
  },
  crate: {
    w: 1, h: 1, solid: true, name: 'ארגז', examine: ['ארגז פירות ריק. מדבקה: "תוצרת הארץ".', 'ארגזי בירה ריקים, ערומים זה על זה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 12, 13, 3);
      r(ctx, px + 2, py + 1, 12, 11, '#8a6a3f');
      r(ctx, px + 2, py + 1, 12, 1, '#a88552');
      r(ctx, px + 2, py + 5, 12, 1, '#6b5030');
      r(ctx, px + 2, py + 9, 12, 1, '#6b5030');
      r(ctx, px + 4, py - 5, 9, 6, '#7a5c35');
      r(ctx, px + 4, py - 5, 9, 1, '#a88552');
    },
  },
  trash: {
    w: 1, h: 1, solid: true, name: 'פח אשפה', examine: ['פח עירוני ירוק. החתולים כבר עברו פה.', 'פח מלא עד אפס מקום. ריח של דגים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 3, py + 12, 11, 3);
      r(ctx, px + 3, py, 10, 12, '#2f5a3a');
      r(ctx, px + 2, py - 2, 12, 3, '#3b6e48');
      r(ctx, px + 5, py + 3, 1, 7, '#244530');
      r(ctx, px + 9, py + 3, 1, 7, '#244530');
    },
  },
  dumpster: {
    w: 2, h: 1, solid: true, name: 'מכולת אשפה', examine: ['מכולת אשפה גדולה. המכסה פתוח, שקיות זרוקות מסביב.', 'מכולה מתכתית עם גרפיטי וריח חמוץ.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 31, 3);
      r(ctx, px + 1, py - 4, 30, 16, '#24543b');
      r(ctx, px, py - 6, 32, 3, '#2f6b4b');
      r(ctx, px + 4, py - 1, 24, 1, '#1b3f2c');
      r(ctx, px + 6, py + 3, 9, 3, '#e5e7eb');
      r(ctx, px + 7, py + 4, 2, 1, '#dc2626');
      r(ctx, px + 20, py + 8, 6, 3, '#111');
    },
  },
  barrel: {
    w: 1, h: 1, solid: true, name: 'חבית', examine: ['חבית מתכת חלודה. בפנים מים שחורים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 3, py + 12, 11, 3);
      r(ctx, px + 3, py - 2, 10, 14, '#7c2d12');
      r(ctx, px + 3, py + 2, 10, 1, '#5a2410');
      r(ctx, px + 3, py + 7, 10, 1, '#5a2410');
      r(ctx, px + 4, py - 3, 8, 2, '#9a3b16');
    },
  },
  busStop: {
    w: 3, h: 1, solid: true, name: 'תחנת אוטובוס', examine: ['תחנת אוטובוס. לוח הזמנים מראה קו שבוטל לפני שנתיים.', 'על הספסל מישהו ישן תחת מעיל.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 47, 3);
      r(ctx, px + 1, py - 14, 46, 3, '#2c3e50');
      r(ctx, px + 2, py - 11, 1, 24, '#4b5563');
      r(ctx, px + 45, py - 11, 1, 24, '#4b5563');
      r(ctx, px + 3, py - 11, 42, 14, 'rgba(147,197,253,0.18)');
      r(ctx, px + 30, py - 10, 12, 10, '#f5f5f4');
      r(ctx, px + 31, py - 9, 10, 2, '#16a34a');
      r(ctx, px + 6, py + 5, 20, 3, '#6b7280');
    },
  },
  pillar: {
    w: 1, h: 1, solid: true, name: 'עמוד בטון', examine: ['עמוד בטון עם ברזלים חשופים. גרפיטי: "התחנה מתה".', 'עמוד עם סימני מים בגובה הברך מהחורף שעבר.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 15, 4);
      r(ctx, px + 2, py - 18, 12, 31, '#6e7073');
      r(ctx, px + 2, py - 18, 2, 31, '#808285');
      r(ctx, px + 12, py - 18, 2, 31, '#56585b');
      r(ctx, px + 5, py - 6, 4, 1, '#7c3a2d');
      r(ctx, px + 2, py + 6, 12, 2, '#4d4f52');
    },
  },
  fence: {
    w: 1, h: 1, solid: true, name: 'גדר', examine: ['גדר רשת עם חור בפינה, בגודל של אדם.', 'גדר איסכורית חלודה.'],
    draw(ctx, px, py) {
      r(ctx, px, py - 6, 16, 1, '#6b7280');
      r(ctx, px, py + 8, 16, 1, '#6b7280');
      for (let x = 0; x < 16; x += 3) r(ctx, px + x, py - 6, 1, 15, '#4b5563');
      r(ctx, px, py - 6, 1, 18, '#374151');
    },
  },
  fenceV: {
    w: 1, h: 1, solid: true, name: 'גדר', examine: ['גדר רשת. מעבר לה, חצר מוזנחת.'],
    draw(ctx, px, py) {
      r(ctx, px + 7, py - 8, 2, 22, '#4b5563');
      for (let y = -8; y < 14; y += 3) r(ctx, px + 6, py + y, 4, 1, '#6b7280');
    },
  },
  hydrant: {
    w: 1, h: 1, solid: true, name: 'ברז כיבוי', examine: ['ברז כיבוי אש צהוב. מישהו קשר אליו אופניים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 4, py + 11, 9, 2);
      r(ctx, px + 6, py + 1, 5, 11, '#d4a017');
      r(ctx, px + 5, py, 7, 2, '#b8860b');
      r(ctx, px + 4, py + 5, 9, 2, '#b8860b');
    },
  },
  planter: {
    w: 1, h: 1, solid: true, name: 'אדנית', examine: ['אדנית בטון עם צמחים יבשים ובדלים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 15, 3);
      r(ctx, px + 1, py + 3, 14, 10, '#7b7d80');
      r(ctx, px + 1, py + 3, 14, 1, '#9a9c9f');
      r(ctx, px + 2, py - 2, 12, 6, '#3c5a2f');
      r(ctx, px + 4, py - 4, 4, 3, '#4c7039');
    },
  },
  cafeTable: {
    w: 1, h: 1, solid: true, name: 'שולחן בית קפה', examine: ['שולחן פלסטיק עם מאפרה וכוסות תה ריקות.', 'שני כיסאות, שולחן קטן, וקלפי שש-בש.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 12, 13, 3);
      r(ctx, px + 3, py + 2, 10, 6, '#e5e7eb');
      r(ctx, px + 7, py + 8, 2, 4, '#9ca3af');
      r(ctx, px, py + 4, 3, 7, '#b91c1c');
      r(ctx, px + 13, py + 4, 3, 7, '#b91c1c');
      r(ctx, px + 5, py + 3, 2, 2, '#92400e');
    },
  },
  sacks: {
    w: 1, h: 1, solid: true, name: 'שקי תבלינים', examine: ['שקי יוטה: כמון, כורכום, פפריקה. האבקה צובעת את הידיים.', 'שקים של פיצוחים ושקדים.'],
    draw(ctx, px, py, p) {
      const c = p.color ?? '#c2410c';
      shadow(ctx, px + 1, py + 12, 15, 3);
      r(ctx, px + 1, py + 2, 7, 10, '#b59a6b');
      r(ctx, px + 8, py + 3, 7, 9, '#a88d5f');
      r(ctx, px + 2, py + 2, 5, 3, c);
      r(ctx, px + 9, py + 3, 5, 3, shade(c, 0.3));
    },
  },
  speaker: {
    w: 1, h: 1, solid: true, name: 'רמקול', examine: ['רמקול ענק. הרצפה רועדת מהבס.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 15, 3);
      r(ctx, px + 2, py - 10, 12, 23, '#111114');
      r(ctx, px + 4, py - 8, 8, 8, '#2a2a30');
      r(ctx, px + 6, py - 6, 4, 4, '#3f3f46');
      r(ctx, px + 4, py + 2, 8, 8, '#2a2a30');
      r(ctx, px + 6, py + 4, 4, 4, '#3f3f46');
    },
  },
  djBooth: {
    w: 2, h: 1, solid: true, name: 'עמדת די-ג׳יי', examine: ['עמדת די-ג׳יי. פלייליסט על פתק: טכנו, טכנו, עוד טכנו.'],
    draw(ctx, px, py, _p, t) {
      shadow(ctx, px + 1, py + 12, 31, 3);
      r(ctx, px + 1, py + 2, 30, 11, '#1c1a22');
      r(ctx, px + 4, py + 3, 9, 5, '#0d0d10');
      r(ctx, px + 19, py + 3, 9, 5, '#0d0d10');
      r(ctx, px + 7, py + 5, 3, 1, '#a855f7');
      r(ctx, px + 22, py + 5, 3, 1, '#a855f7');
      for (let i = 0; i < 6; i++) r(ctx, px + 4 + i * 4, py + 10, 2, 1, Math.floor(t * 6 + i) % 3 ? '#22d3ee' : '#f472b6');
    },
  },
  stool: {
    w: 1, h: 1, solid: false, minor: true, name: 'כיסא בר', examine: ['כיסא בר גבוה עם ריפוד קרוע.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 5, py + 12, 7, 2);
      r(ctx, px + 4, py + 2, 8, 3, '#7f1d1d');
      r(ctx, px + 7, py + 5, 2, 7, '#71717a');
    },
  },
  scooter: {
    w: 1, h: 1, solid: false, name: 'קורקינט חשמלי', examine: ['קורקינט שכור זרוק על המדרכה. הסוללה ריקה.', 'אופנוע משלוחים עם ארגז תרמי.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 15, 2);
      r(ctx, px + 2, py + 9, 12, 2, '#1f2937');
      r(ctx, px + 12, py - 2, 2, 11, '#374151');
      r(ctx, px + 10, py - 3, 6, 1, '#111827');
      r(ctx, px + 1, py + 10, 3, 3, '#0e0f12');
      r(ctx, px + 12, py + 10, 3, 3, '#0e0f12');
      r(ctx, px + 4, py + 8, 6, 1, '#22c55e');
    },
  },
  cctvBox: {
    w: 1, h: 1, solid: true, name: 'מערכת הקלטה', examine: ['מסך מחולק לשש מצלמות ומקליט דיגיטלי עם נורה ירוקה.'],
    draw(ctx, px, py, _p, t) {
      shadow(ctx, px + 1, py + 12, 15, 3);
      r(ctx, px + 1, py + 3, 14, 10, '#3f2c1d');
      r(ctx, px + 2, py - 7, 12, 10, '#111318');
      for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) r(ctx, px + 3 + i * 4, py - 6 + j * 4, 3, 3, (i + j + Math.floor(t)) % 4 ? '#3c4a5c' : '#5a6b80');
      r(ctx, px + 3, py + 5, 10, 3, '#1f2125');
      r(ctx, px + 11, py + 6, 1, 1, '#22c55e');
    },
  },
  terminal: {
    w: 1, h: 1, solid: true, name: 'מסוף מחשב', examine: ['מסוף של מערכת פל״א. צריך כרטיס חכם וסיסמה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 1, py + 12, 15, 3);
      r(ctx, px + 1, py + 4, 14, 9, '#4b5563');
      r(ctx, px + 3, py - 6, 10, 9, '#111318');
      r(ctx, px + 4, py - 5, 8, 7, '#0f3b2e');
      r(ctx, px + 5, py - 4, 5, 1, '#34d399');
      r(ctx, px + 5, py - 2, 3, 1, '#34d399');
      r(ctx, px + 3, py + 6, 10, 2, '#1f2937');
    },
  },
  pinboard: {
    w: 2, h: 1, solid: true, name: 'לוח חקירה', examine: ['לוח שעם על חצובה, עם תמונות, פתקים וחוטים אדומים.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 12, 28, 3);
      r(ctx, px + 4, py - 16, 24, 18, '#7a5a3a');
      r(ctx, px + 5, py - 15, 22, 16, '#a07a4e');
      r(ctx, px + 7, py - 13, 5, 6, '#e5e7eb');
      r(ctx, px + 18, py - 12, 6, 5, '#e5e7eb');
      r(ctx, px + 12, py - 6, 5, 5, '#fde68a');
      r(ctx, px + 10, py - 9, 9, 1, '#dc2626');
      r(ctx, px + 7, py + 2, 2, 11, '#4a3221');
      r(ctx, px + 23, py + 2, 2, 11, '#4a3221');
    },
  },
  sandbox: {
    w: 2, h: 2, solid: true, name: 'מתקן משחקים', examine: ['מגלשה ישנה בגינה הציבורית. ילדי השכונה עוד משחקים פה.'],
    draw(ctx, px, py) {
      shadow(ctx, px + 2, py + 26, 28, 4);
      r(ctx, px + 2, py + 6, 28, 20, '#a68a5b');
      r(ctx, px + 6, py - 6, 3, 30, '#b91c1c');
      r(ctx, px + 22, py - 6, 3, 30, '#b91c1c');
      r(ctx, px + 6, py - 8, 19, 3, '#1d4ed8');
      r(ctx, px + 10, py + 2, 10, 18, '#facc15');
    },
  },

  /* ---------------- Ground decals (static layer) ---------------- */
  rug: {
    w: 2, h: 2, solid: false, flat: true, name: 'שטיח', examine: ['שטיח פרסי שחוק.'],
    draw(ctx, px, py, p) {
      const c = p.color ?? '#6b2333';
      r(ctx, px + 1, py + 1, p.w * T - 2, p.h * T - 2, c);
      r(ctx, px + 3, py + 3, p.w * T - 6, p.h * T - 6, shade(c, 0.15));
      r(ctx, px + 5, py + 5, p.w * T - 10, p.h * T - 10, shade(c, -0.15));
    },
  },
  puddle: {
    w: 2, h: 1, solid: false, minor: true, flat: true, name: 'שלולית', examine: ['שלולית שמשקפת את אור הפנסים.'],
    draw(ctx, px, py) {
      ctx.fillStyle = 'rgba(120,150,190,0.25)';
      ctx.fillRect(px + 4, py + 5, 22, 6);
      ctx.fillRect(px + 7, py + 3, 14, 10);
      ctx.fillStyle = 'rgba(200,220,255,0.25)';
      ctx.fillRect(px + 9, py + 6, 6, 1);
    },
  },
  mattress: {
    w: 2, h: 1, solid: false, flat: true, name: 'מזרן', examine: ['מזרן מוכתם וקרטונים. מישהו גר פה.', 'שמיכה, בקבוק מים ושקית עם בגדים.'],
    draw(ctx, px, py) {
      r(ctx, px + 2, py + 2, 28, 12, '#8b7d6b');
      r(ctx, px + 2, py + 2, 28, 1, '#a39581');
      r(ctx, px + 12, py + 4, 14, 8, '#3f4a6b');
      r(ctx, px + 4, py + 4, 6, 5, '#d6cfc0');
    },
  },
  cardboard: {
    w: 1, h: 1, solid: false, minor: true, flat: true, name: 'קרטונים', examine: ['קרטונים פרוסים על הרצפה.'],
    draw(ctx, px, py) {
      r(ctx, px + 1, py + 3, 13, 10, '#9a7b52');
      r(ctx, px + 3, py + 5, 9, 1, '#7a5f3c');
    },
  },
  manhole: {
    w: 1, h: 1, solid: false, minor: true, flat: true, name: 'מכסה ביוב', examine: ['מכסה ביוב עם סמל עיריית תל אביב-יפו.'],
    draw(ctx, px, py) {
      r(ctx, px + 3, py + 4, 10, 8, '#1f2125');
      r(ctx, px + 4, py + 3, 8, 10, '#1f2125');
      r(ctx, px + 5, py + 6, 6, 1, '#34373d');
      r(ctx, px + 5, py + 9, 6, 1, '#34373d');
    },
  },
  stain: {
    w: 1, h: 1, solid: false, flat: true, name: 'כתם', examine: ['כתם כהה על הרצפה. אולי שמן, אולי לא.'],
    draw(ctx, px, py) {
      ctx.fillStyle = 'rgba(40,10,10,0.45)';
      ctx.fillRect(px + 3, py + 5, 9, 5);
      ctx.fillRect(px + 5, py + 3, 5, 9);
    },
  },

  /* ---------------- Wall decorations (on the wall face) ---------------- */
  window: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'חלון', examine: ['חלון עם סורגים. מבפנים נשמעת טלוויזיה.', 'חלון מואר. וילון זז ונעצר.', 'חלון סגור בתריס פלסטיק.'],
    draw(ctx, px, py, p) {
      const lit = (p.variant ?? hashString(p.id)) % 3 !== 0;
      r(ctx, px + 3, py + 5, 10, 8, '#22252b');
      r(ctx, px + 4, py + 6, 8, 6, lit ? '#e8c46a' : '#1b2633');
      if (lit) r(ctx, px + 4, py + 6, 8, 2, '#f3dc96');
      r(ctx, px + 7, py + 6, 1, 6, '#22252b');
      for (let x = 4; x < 12; x += 3) r(ctx, px + x, py + 5, 1, 8, 'rgba(20,20,20,0.6)');
    },
  },
  ac: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'מזגן', examine: ['מנוע מזגן מטפטף על המדרכה.', 'מזגן ישן שמרעיש כמו טרקטור.'],
    draw(ctx, px, py) {
      r(ctx, px + 2, py + 5, 12, 8, '#d6d3cc');
      r(ctx, px + 3, py + 6, 6, 6, '#8a8780');
      r(ctx, px + 4, py + 7, 4, 4, '#6b6862');
      r(ctx, px + 10, py + 7, 3, 1, '#8a8780');
      r(ctx, px + 10, py + 9, 3, 1, '#8a8780');
    },
  },
  shutter: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'תריס חנות', examine: ['תריס גלילה מוגף. ריסוס: "להשכרה".', 'תריס מתכת סגור עם מנעול תלייה.'],
    draw(ctx, px, py, p) {
      const w = p.w * T;
      r(ctx, px + 1, py + 4, w - 2, 11, '#6b7075');
      for (let y = 5; y < 15; y += 2) r(ctx, px + 1, py + y, w - 2, 1, '#565a5f');
      r(ctx, px + w / 2 - 2, py + 13, 4, 2, '#c9a54a');
    },
  },
  storageDoor: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'דלת מחסן', examine: ['דלת גלילה של מחסן, נעולה במנעול תלייה.'],
    draw(ctx, px, py) {
      r(ctx, px + 1, py + 3, 14, 12, '#7c8187');
      for (let y = 4; y < 15; y += 2) r(ctx, px + 1, py + y, 14, 1, '#5f646a');
      r(ctx, px + 7, py + 12, 3, 3, '#c9a54a');
    },
  },
  sign: {
    w: 3, h: 1, solid: false, flat: true, wall: true, name: 'שלט', examine: ['שלט של עסק. האותיות דהויות מהשמש.'],
    draw(ctx, px, py, p) {
      const w = p.w * T;
      const c = p.color ?? '#1e3a5f';
      r(ctx, px + 1, py + 3, w - 2, 8, '#14161a');
      r(ctx, px + 2, py + 4, w - 4, 6, c);
      r(ctx, px + 2, py + 4, w - 4, 1, shade(c, 0.25));
    },
  },
  neon: {
    w: 3, h: 1, solid: false, flat: true, wall: true, name: 'שלט ניאון', examine: ['שלט ניאון. אחת האותיות כבויה.'],
    draw(ctx, px, py, p) {
      const w = p.w * T;
      const c = p.color ?? '#f472b6';
      r(ctx, px + 1, py + 3, w - 2, 9, '#0d0b12');
      r(ctx, px + 2, py + 4, w - 4, 1, c);
      r(ctx, px + 2, py + 10, w - 4, 1, c);
      r(ctx, px + 2, py + 4, 1, 7, c);
      r(ctx, px + w - 3, py + 4, 1, 7, c);
    },
  },
  graffiti: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'גרפיטי', examine: ['גרפיטי: "העיר הזאת לא ישנה".', 'תג של צוות גרפיטי מקומי, מעל פוסטר של מסיבה.', 'ריסוס: "תל אביב לכולם".'],
    draw(ctx, px, py, p) {
      const cols = ['#ec4899', '#22d3ee', '#a3e635', '#f59e0b'];
      const c = pick(p, cols);
      for (let i = 0; i < 9; i++) r(ctx, px + 3 + i * 3, py + 6 + ((i * 5) % 5), 3, 2, i % 2 ? c : shade(c, -0.3));
      r(ctx, px + 4, py + 11, 22, 1, shade(c, -0.4));
    },
  },
  poster: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'מודעה', examine: ['מודעת אבל ישנה, חצי קרועה.', 'מודעה: "דרוש/ה עובד/ת למטבח. משמרות לילה".', 'פוסטר של הופעה בבארבי, משנה שעברה.'],
    draw(ctx, px, py, p) {
      const c = pick(p, ['#e7e5e4', '#fde68a', '#fecaca', '#bfdbfe']);
      r(ctx, px + 4, py + 4, 8, 9, c);
      r(ctx, px + 5, py + 6, 6, 1, '#44403c');
      r(ctx, px + 5, py + 8, 4, 1, '#78716c');
      r(ctx, px + 5, py + 10, 5, 1, '#78716c');
    },
  },
  corkboard: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'לוח מודעות', examine: ['לוח מודעות: משמרות, נוהל ירי, והזמנה ליום הולדת של מישהו.'],
    draw(ctx, px, py) {
      r(ctx, px + 2, py + 4, 28, 10, '#6b4a2d');
      r(ctx, px + 3, py + 5, 26, 8, '#a07a4e');
      r(ctx, px + 5, py + 6, 5, 5, '#f5f5f4');
      r(ctx, px + 12, py + 6, 6, 4, '#fde68a');
      r(ctx, px + 21, py + 7, 5, 5, '#e5e7eb');
    },
  },
  whiteboard: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'לוח מחיק', examine: ['לוח מחיק עם שרטוט של צומת וחצים. מישהו כתב: "מי ידע על המשלוח?".'],
    draw(ctx, px, py) {
      r(ctx, px + 2, py + 4, 28, 10, '#9ca3af');
      r(ctx, px + 3, py + 5, 26, 8, '#f1f5f9');
      r(ctx, px + 5, py + 7, 10, 1, '#1d4ed8');
      r(ctx, px + 8, py + 9, 12, 1, '#dc2626');
      r(ctx, px + 22, py + 6, 4, 4, '#1d4ed8');
    },
  },
  clock: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'שעון קיר', examine: ['שעון קיר. מפגר בשבע דקות כבר שנה.'],
    draw(ctx, px, py) {
      r(ctx, px + 4, py + 4, 8, 8, '#1f2937');
      r(ctx, px + 5, py + 5, 6, 6, '#f8fafc');
      r(ctx, px + 7, py + 6, 1, 3, '#111');
      r(ctx, px + 8, py + 8, 2, 1, '#111');
    },
  },
  mirror: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'מראה חד-כיוונית', examine: ['מראה חד-כיוונית. מהצד השני - חדר תצפית.'],
    draw(ctx, px, py) {
      r(ctx, px + 2, py + 4, 28, 9, '#20242b');
      r(ctx, px + 3, py + 5, 26, 7, '#3d4a5a');
      r(ctx, px + 5, py + 6, 8, 1, '#7c8ea5');
    },
  },
  cctvCam: {
    w: 1, h: 1, solid: false, flat: true, wall: true, name: 'מצלמת אבטחה', examine: ['מצלמת אבטחה מכוונת לרחוב. נורה אדומה קטנה דולקת.'],
    draw(ctx, px, py) {
      r(ctx, px + 5, py + 4, 2, 3, '#4b5563');
      r(ctx, px + 6, py + 6, 7, 4, '#d1d5db');
      r(ctx, px + 12, py + 7, 2, 2, '#1f2937');
      r(ctx, px + 7, py + 7, 1, 1, '#ef4444');
    },
  },
  policeBadge: {
    w: 2, h: 1, solid: false, flat: true, wall: true, name: 'סמל המשטרה', examine: ['סמל משטרת ישראל על הקיר: ענפי זית ומגן דוד.'],
    draw(ctx, px, py) {
      r(ctx, px + 10, py + 3, 12, 11, '#1e3a8a');
      r(ctx, px + 12, py + 5, 8, 7, '#c9a54a');
      r(ctx, px + 14, py + 7, 4, 3, '#1e3a8a');
      r(ctx, px + 6, py + 6, 4, 6, '#3f6b33');
      r(ctx, px + 22, py + 6, 4, 6, '#3f6b33');
    },
  },
};

/** Small evidence items left at a scene (no glow, no marker). */
export function drawEvidenceItem(ctx: Ctx, px: number, py: number, kind: string) {
  const cx = px + 8;
  const cy = py + 10;
  switch (kind) {
    case 'cctv':
      r(ctx, cx - 6, cy - 7, 12, 10, '#111318');
      r(ctx, cx - 5, cy - 6, 10, 7, '#344255');
      r(ctx, cx - 3, cy - 4, 4, 1, '#94a3b8');
      r(ctx, cx - 6, cy + 3, 12, 2, '#1f2125');
      break;
    default:
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(cx - 4, cy + 2, 9, 2);
      r(ctx, cx - 3, cy - 2, 7, 4, '#d6cfc0');
      r(ctx, cx - 2, cy - 1, 2, 1, '#7c2d12');
      r(ctx, cx + 1, cy - 3, 3, 2, '#2b2f35');
  }
}

export function propDef(p: Prop): PropDef {
  return PROPS[p.type] ?? PROPS.crate;
}

export function examineText(p: Prop): string {
  if (p.examine) return p.examine;
  const d = propDef(p);
  return d.examine[hashString(p.id) % d.examine.length];
}

export function propName(p: Prop): string {
  return p.name ?? propDef(p).name;
}
