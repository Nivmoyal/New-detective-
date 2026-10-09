import type { CharacterLook, CharacterRef, HairStyle, Outfit } from '../types/investigation';

/* ------------------------------------------------------------------ */
/* Palettes for the character creator                                  */
/* ------------------------------------------------------------------ */

export const SKIN_TONES = ['#f3d2b3', '#e5b48f', '#c98f66', '#9c6644', '#6b4430'];
export const HAIR_COLORS = ['#16120f', '#3b2618', '#6b4423', '#a8743f', '#7a2e1a', '#bdb6ad'];
export const TOP_COLORS = ['#1f2a3a', '#2b2b2e', '#4a3426', '#3d4a3a', '#5e1f26', '#9aa3ad'];
export const PANTS_COLORS = ['#17191d', '#2d3440', '#3b3a36', '#24324a', '#4b4033'];

export const HAIR_STYLE_OPTIONS: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'קצר' },
  { id: 'buzz', label: 'קוצים' },
  { id: 'long', label: 'ארוך' },
  { id: 'bun', label: 'פקעות' },
  { id: 'bald', label: 'קרחת' },
];

export const PLAYER_OUTFITS: { id: Outfit; label: string }[] = [
  { id: 'blazer', label: 'ז׳קט וחולצה' },
  { id: 'suit', label: 'חליפה ועניבה' },
  { id: 'leather', label: 'מעיל עור' },
  { id: 'hoodie', label: 'קפוצ׳ון' },
];

export function defaultPlayerLook(body: 'male' | 'female' = 'male'): CharacterLook {
  return {
    body,
    skin: SKIN_TONES[1],
    hairStyle: body === 'male' ? 'short' : 'long',
    hairColor: HAIR_COLORS[0],
    outfit: 'leather',
    topColor: TOP_COLORS[2],
    pantsColor: PANTS_COLORS[0],
    beard: false,
    glasses: false,
  };
}

/* ------------------------------------------------------------------ */
/* Station staff                                                       */
/* ------------------------------------------------------------------ */

const UNIFORM_BLUE = '#8fb0d4';

export const COMMANDER: CharacterRef = {
  name: 'סנ״צ אורנה ברק',
  role: 'מפקדת תחנת שרפשטיין',
  look: {
    body: 'female',
    skin: '#e5b48f',
    hairStyle: 'bun',
    hairColor: '#2a1d14',
    outfit: 'uniform',
    topColor: UNIFORM_BLUE,
    pantsColor: '#1d2633',
    cap: false,
    height: 1.0,
  },
};

export const MENTOR: CharacterRef = {
  name: 'רפ״ק יוסי כהן',
  role: 'ראש צוות חקירות, משרד חוקרים',
  look: {
    body: 'male',
    skin: '#c98f66',
    hairStyle: 'short',
    hairColor: '#8d877f',
    outfit: 'blazer',
    topColor: '#4a3426',
    pantsColor: '#2d3440',
    beard: true,
    height: 1.03,
  },
};

export const LAB_TECH: CharacterRef = {
  name: 'ד״ר מאיה שטרן',
  role: 'ראש מעבדת מז״פ',
  look: {
    body: 'female',
    skin: '#f3d2b3',
    hairStyle: 'long',
    hairColor: '#7a2e1a',
    outfit: 'labcoat',
    topColor: '#f1f3f5',
    pantsColor: '#2d3440',
    glasses: true,
  },
};

export const EVIDENCE_CLERK: CharacterRef = {
  name: 'רס״ב ניסים חדד',
  role: 'אחראי חדר ראיות',
  look: {
    body: 'male',
    skin: '#9c6644',
    hairStyle: 'bald',
    hairColor: '#16120f',
    outfit: 'uniform',
    topColor: UNIFORM_BLUE,
    pantsColor: '#1d2633',
    glasses: true,
    beard: true,
    height: 0.97,
  },
};

export const INTERROGATION_OFFICER: CharacterRef = {
  name: 'רס״ל אבי מזרחי',
  role: 'שוטר משמרת, אגף העצורים',
  look: {
    body: 'male',
    skin: '#e5b48f',
    hairStyle: 'buzz',
    hairColor: '#16120f',
    outfit: 'uniform',
    topColor: UNIFORM_BLUE,
    pantsColor: '#1d2633',
    cap: true,
    height: 1.05,
  },
};

export const PATROL_DRIVER: CharacterRef = {
  name: 'שוטרת סיור ליאת אזולאי',
  role: 'נהגת ניידת',
  look: {
    body: 'female',
    skin: '#c98f66',
    hairStyle: 'ponytail',
    hairColor: '#16120f',
    outfit: 'uniform',
    topColor: '#1f2f4a',
    pantsColor: '#1d2633',
    cap: true,
  },
};

export const DESK_SERGEANT: CharacterRef = {
  name: 'רס״ל עדי פרץ',
  role: 'תורנית דלפק',
  look: {
    body: 'female',
    skin: '#e5b48f',
    hairStyle: 'curly',
    hairColor: '#3b2618',
    outfit: 'uniform',
    topColor: UNIFORM_BLUE,
    pantsColor: '#1d2633',
  },
};

/** Characters standing at station facilities; talking to them triggers the facility. */
export const FACILITY_CHARACTERS: Record<string, CharacterRef> = {
  'f-commander': COMMANDER,
  'f-lab': LAB_TECH,
  'f-evidence': EVIDENCE_CLERK,
  'f-interrogation': INTERROGATION_OFFICER,
  'f-exit': PATROL_DRIVER,
  'f-exit-lev': PATROL_DRIVER,
  'f-exit-ns': PATROL_DRIVER,
  'f-exit-cbs': PATROL_DRIVER,
  'f-exit-fl': PATROL_DRIVER,
  'f-exit-sh': PATROL_DRIVER,
};

/** People you can chat with who are not tied to a facility or a case. */
export interface ChatNpc {
  id: string;
  mapId: string;
  x: number;
  y: number;
  facing: number;
  character: CharacterRef;
  lines: string[];
}

export const CHAT_NPCS: ChatNpc[] = [
  {
    id: 'npc-mentor',
    mapId: 'station',
    x: 9.5,
    y: 1.6,
    facing: 0,
    character: MENTOR,
    lines: [
      'טיפ ממני: אל תחברו ללוח שום דבר שלא בדקתם עד הסוף. כל חוט אדום שקורס בפרקליטות - חוזר אליכם.',
      'אליבי טוב שווה זהב. הוא לא רק מנקה חשוד - הוא מצמצם לכם את הרשימה.',
      'בחדר החקירות, לחץ בלי ראיות זה רק רעש. קודם מניחים את הראיה על השולחן, אחר כך לוחצים.',
      'מז״פ זה לא פורמליות. ראיה פיזית שלא עברה מעבדה - לא קיימת מבחינת הלוח.',
    ],
  },
  {
    id: 'npc-sergeant',
    mapId: 'station',
    x: 9.5,
    y: 12.5,
    facing: Math.PI / 2,
    character: DESK_SERGEANT,
    lines: [
      'בוקר. הקפה במטבחון, המעלית לא עובדת, ומישהו שוב החנה על המקום של המפקדת.',
      'שמעתי שקיבלת תיק כבר ביום הראשון. המפקדת לא עושה את זה לכל אחד.',
      'אם אתם יוצאים לשטח, ליאת מחכה בניידת בחניון. היא מכירה כל סמטה בדרום העיר.',
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Ambient pedestrians                                                 */
/* ------------------------------------------------------------------ */

export interface Pedestrian {
  mapId: string;
  path: { x: number; y: number }[];
  speed: number;
  look: CharacterLook;
}

const ped = (
  body: 'male' | 'female',
  skin: string,
  hairStyle: HairStyle,
  hairColor: string,
  outfit: Outfit,
  topColor: string,
): CharacterLook => ({ body, skin, hairStyle, hairColor, outfit, topColor, pantsColor: '#22252b' });

export const PEDESTRIANS: Pedestrian[] = [
  { mapId: 'levinsky', path: [{ x: 2.5, y: 3.5 }, { x: 23.5, y: 3.5 }], speed: 1.1, look: ped('female', '#e5b48f', 'long', '#16120f', 'tshirt', '#6b4a7a') },
  { mapId: 'levinsky', path: [{ x: 22.5, y: 12.5 }, { x: 2.5, y: 12.5 }], speed: 0.9, look: ped('male', '#9c6644', 'short', '#16120f', 'hoodie', '#5e1f26') },
  { mapId: 'levinsky', path: [{ x: 9.5, y: 1.5 }, { x: 18.5, y: 1.5 }], speed: 0.7, look: ped('male', '#e5b48f', 'bald', '#16120f', 'tshirt', '#4b5a6b') },
  { mapId: 'neveShaanan', path: [{ x: 2.5, y: 9.5 }, { x: 20.2, y: 9.5 }], speed: 1.0, look: ped('male', '#6b4430', 'buzz', '#16120f', 'tshirt', '#2f5d50') },
  { mapId: 'neveShaanan', path: [{ x: 22.5, y: 17.5 }, { x: 2.5, y: 17.5 }], speed: 0.8, look: ped('female', '#6b4430', 'bun', '#16120f', 'tshirt', '#a3472b') },
  { mapId: 'oldCbs', path: [{ x: 2.5, y: 17.5 }, { x: 23.5, y: 17.5 }], speed: 0.6, look: ped('male', '#c98f66', 'curly', '#3b2618', 'hoodie', '#2b2b2e') },
  { mapId: 'florentin', path: [{ x: 2.5, y: 4.5 }, { x: 23.5, y: 4.5 }], speed: 1.2, look: ped('female', '#f3d2b3', 'ponytail', '#a8743f', 'leather', '#1c1c1c') },
  { mapId: 'florentin', path: [{ x: 8.5, y: 10.5 }, { x: 22.5, y: 12.5 }], speed: 0.5, look: ped('male', '#e5b48f', 'curly', '#16120f', 'tshirt', '#7c3aed') },
  { mapId: 'florentin', path: [{ x: 20.5, y: 7.5 }, { x: 9.5, y: 7.5 }], speed: 0.5, look: ped('female', '#c98f66', 'long', '#16120f', 'tshirt', '#be185d') },
  { mapId: 'shapira', path: [{ x: 2.5, y: 9.5 }, { x: 22.5, y: 9.5 }], speed: 0.8, look: ped('female', '#e5b48f', 'bun', '#bdb6ad', 'blazer', '#6b5a4a') },
  { mapId: 'shapira', path: [{ x: 5.5, y: 16.5 }, { x: 22.5, y: 16.5 }], speed: 0.9, look: ped('male', '#9c6644', 'short', '#16120f', 'tshirt', '#3d6b8a') },
  { mapId: 'station', path: [{ x: 2.5, y: 7.5 }, { x: 23.5, y: 7.5 }], speed: 0.9, look: { ...ped('male', '#e5b48f', 'short', '#3b2618', 'uniform', UNIFORM_BLUE), pantsColor: '#1d2633' } },
];
