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
  { id: 'ponytail', label: 'קוקו' },
  { id: 'curly', label: 'מתולתל' },
  { id: 'bun', label: 'פקעת' },
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

/** Someone the detective can simply talk to. */
export interface ChatNpc {
  id: string;
  character: CharacterRef;
  lines: string[];
  /** Their own way of saying there is nothing more to tell. */
  done?: string;
}
