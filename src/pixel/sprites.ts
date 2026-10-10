// Procedural pixel-art character sprites: 4 directions x 4 walk frames,
// painted pixel by pixel from a CharacterLook, with a dark outline.
import type { CharacterLook } from '../types/investigation';
import { PixelBuffer, mix, shade } from './color';

export const FRAME_W = 18;
export const FRAME_H = 27;
/** Feet position inside a frame (where the character stands). */
export const FOOT_X = 9;
export const FOOT_Y = 25;

export type Dir = 0 | 1 | 2 | 3; // down, left, right, up
export const DIR_DOWN: Dir = 0;
export const DIR_LEFT: Dir = 1;
export const DIR_RIGHT: Dir = 2;
export const DIR_UP: Dir = 3;

const OUTLINE = '#0d1117';
const SHOE = '#1b1a1d';
const EYE = '#16151c';
const WHITE_SHIRT = '#e9e7e1';

export interface Palette {
  skin: string;
  skinShade: string;
  skinDark: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  top: string;
  topShade: string;
  topLight: string;
  pants: string;
  pantsShade: string;
  lip: string;
}

export function paletteFor(look: CharacterLook): Palette {
  return {
    skin: look.skin,
    skinShade: shade(look.skin, -0.16),
    skinDark: shade(look.skin, -0.32),
    hair: look.hairColor,
    hairShade: shade(look.hairColor, -0.3),
    hairLight: shade(look.hairColor, 0.22),
    top: look.topColor,
    topShade: shade(look.topColor, -0.28),
    topLight: shade(look.topColor, 0.16),
    pants: look.pantsColor,
    pantsShade: shade(look.pantsColor, -0.3),
    lip: mix(look.skin, '#8f3a3a', 0.4),
  };
}

/** Painter that maps the 16x24 character grid into a frame of the sheet. */
class Fig {
  constructor(private p: PixelBuffer, private ox: number, private oy: number) {}
  s(x: number, y: number, c: string) {
    this.p.set(this.ox + x, this.oy + y, c);
  }
  r(y: number, x0: number, x1: number, c: string) {
    for (let x = x0; x <= x1; x++) this.s(x, y, c);
  }
  b(x: number, y: number, w: number, h: number, c: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.s(x + i, y + j, c);
  }
}

/* ------------------------------------------------------------------ */
/* Outfit description                                                  */
/* ------------------------------------------------------------------ */

interface OutfitStyle {
  /** Color of the arms (sleeves). */
  sleeve: string;
  sleeveShade: string;
  /** Short sleeves show skin from this row down. */
  shortSleeves: boolean;
  /** Long garment that covers the thighs (lab coat). */
  longCoat?: string;
}

function outfitStyle(look: CharacterLook, pal: Palette): OutfitStyle {
  switch (look.outfit) {
    case 'tshirt':
    case 'apron':
      return { sleeve: pal.top, sleeveShade: pal.topShade, shortSleeves: true };
    case 'uniform':
      return { sleeve: pal.top, sleeveShade: pal.topShade, shortSleeves: true };
    case 'labcoat':
      return { sleeve: '#eef0f2', sleeveShade: '#c3c9d1', shortSleeves: false, longCoat: '#eef0f2' };
    case 'vest':
      return { sleeve: '#cfd2d4', sleeveShade: '#a4a9ae', shortSleeves: false };
    default:
      return { sleeve: pal.top, sleeveShade: pal.topShade, shortSleeves: false };
  }
}

/* ------------------------------------------------------------------ */
/* Front / back view                                                   */
/* ------------------------------------------------------------------ */

function drawFrontBack(f: Fig, look: CharacterLook, pal: Palette, view: 'down' | 'up', frame: number) {
  const female = look.body === 'female';
  const st = outfitStyle(look, pal);
  const back = view === 'up';
  // Torso and arm extents.
  const tx0 = female ? 5 : 4;
  const tx1 = female ? 10 : 11;
  const aL = female ? 3 : 2; // left arm x (2 wide)
  const aR = female ? 11 : 12;
  const lx0 = female ? 6 : 5; // left leg
  const lw = female ? 2 : 3;
  const rx0 = 8;

  // Step: frame 1 lifts the screen-left leg, frame 3 the right one.
  const liftL = frame === 1 ? 1 : 0;
  const liftR = frame === 3 ? 1 : 0;
  // Arms swing opposite to legs.
  const swingL = frame === 3 ? 1 : frame === 1 ? -1 : 0;
  const swingR = -swingL;

  /* Legs and shoes */
  const leg = (x0: number, lift: number, far: boolean) => {
    const c = far ? pal.pantsShade : pal.pants;
    for (let y = 18; y <= 21 - lift; y++) f.r(y, x0, x0 + lw - 1, c);
    f.r(22 - lift, x0, x0 + lw - 1, SHOE);
    f.r(23 - lift, x0, x0 + lw - 1, back ? SHOE : shade(SHOE, 0.12));
    if (!back) f.s(x0 + (x0 < 8 ? 0 : lw - 1), 22 - lift, shade(SHOE, 0.18));
  };
  leg(lx0, liftL, false);
  leg(rx0, liftR, false);
  // Inner leg shadow so the two legs read separately.
  for (let y = 18; y <= 21; y++) f.s(rx0, y, pal.pantsShade);

  /* Long coat over the thighs */
  if (st.longCoat) {
    const cs = shade(st.longCoat, -0.18);
    for (let y = 18; y <= 20; y++) {
      f.r(y, tx0, tx1, st.longCoat);
      f.s(tx1, y, cs);
    }
    if (!back) for (let y = 18; y <= 20; y++) f.r(y, 7, 8, y === 20 ? pal.pants : shade(pal.pants, -0.1));
  }
  if (look.outfit === 'apron' && !back) {
    const ap = '#e5dfd1';
    for (let y = 13; y <= 20; y++) f.r(y, female ? 5 : 5, female ? 10 : 10, y === 20 ? shade(ap, -0.15) : ap);
  }

  /* Arms */
  const arm = (x0: number, swing: number) => {
    for (let y = 11; y <= 16; y++) {
      const short = st.shortSleeves && y >= 14;
      f.r(y, x0, x0 + 1, short ? pal.skin : y === 16 ? st.sleeveShade : st.sleeve);
    }
    f.s(x0 + (x0 < 8 ? 0 : 1), 13, st.sleeveShade);
    const hy = 17 + swing;
    f.r(hy, x0, x0 + 1, pal.skin);
    if (swing > 0) f.r(16, x0, x0 + 1, st.shortSleeves ? pal.skin : st.sleeveShade);
  };
  arm(aL, swingL);
  arm(aR, swingR);

  /* Torso */
  for (let y = 11; y <= 17; y++) f.r(y, tx0, tx1, pal.top);
  f.r(11, tx0 - 1, tx1 + 1, pal.top);
  for (let y = 12; y <= 17; y++) f.s(tx1, y, pal.topShade);
  f.r(17, tx0, tx1, pal.topShade);

  /* Outfit details */
  const o = look.outfit;
  if (o === 'labcoat') {
    for (let y = 11; y <= 17; y++) f.r(y, tx0, tx1, st.longCoat!);
    for (let y = 12; y <= 17; y++) f.s(tx1, y, '#c3c9d1');
    if (!back) {
      f.r(11, 7, 8, pal.top);
      for (let y = 12; y <= 17; y++) f.r(y, 7, 8, y < 14 ? pal.top : '#d5dade');
      f.s(6, 11, '#c3c9d1');
      f.s(9, 11, '#c3c9d1');
      f.s(tx0 + 1, 15, '#b9c0c8');
      f.s(tx1 - 1, 15, '#b9c0c8');
      f.s(tx1 - 1, 12, '#3b82f6');
    }
  } else if (o === 'blazer' || o === 'suit') {
    if (!back) {
      const shirt = WHITE_SHIRT;
      f.r(11, 6, 9, shirt);
      f.r(12, 7, 8, shirt);
      f.r(13, 7, 8, shirt);
      f.s(6, 12, pal.topLight);
      f.s(9, 12, pal.topLight);
      if (o === 'suit') {
        f.r(12, 7, 8, '#6b1d27');
        f.s(7, 13, '#7d2330');
        f.s(8, 13, '#5a1821');
        f.s(7, 14, '#6b1d27');
        f.s(8, 14, pal.topShade);
      } else {
        f.r(14, 7, 8, pal.topShade);
      }
      f.s(8, 15, shade(pal.top, 0.35));
      f.s(8, 16, shade(pal.top, 0.35));
    } else {
      f.r(11, 6, 9, WHITE_SHIRT);
    }
    // Jacket hangs over the belt line.
    f.r(18, tx0, tx1, pal.topShade);
  } else if (o === 'leather') {
    if (!back) {
      const inner = '#b9b3a7';
      for (let y = 11; y <= 16; y++) f.r(y, 7, 8, inner);
      f.r(11, 5, 6, pal.topLight);
      f.r(11, 9, 10, pal.topLight);
      f.s(6, 12, pal.topLight);
      f.s(9, 12, pal.topLight);
      for (let y = 13; y <= 16; y++) {
        f.s(6, y, shade(pal.top, 0.3));
        f.s(9, y, shade(pal.top, 0.3));
      }
    } else {
      f.r(11, 5, 10, pal.topLight);
    }
    f.r(17, tx0, tx1, shade(pal.top, -0.4));
  } else if (o === 'hoodie') {
    if (!back) {
      f.r(11, 6, 9, pal.topShade);
      f.s(7, 12, '#d9d6cf');
      f.s(8, 12, '#d9d6cf');
      f.s(7, 13, '#d9d6cf');
      f.s(8, 14, '#d9d6cf');
      f.r(15, tx0 + 1, tx1 - 1, pal.topShade);
      f.r(16, tx0 + 1, tx1 - 1, pal.topShade);
    } else {
      f.r(11, 5, 10, pal.topShade);
      f.r(12, 5, 10, pal.topShade);
      f.r(13, 6, 9, pal.topShade);
    }
  } else if (o === 'uniform') {
    const navy = '#1c2740';
    f.r(11, tx0 - 1, tx0, navy);
    f.r(11, tx1, tx1 + 1, navy);
    f.s(tx0 - 1, 11, '#c9a54a');
    f.s(tx1 + 1, 11, '#c9a54a');
    if (!back) {
      f.r(11, 7, 8, pal.topShade);
      f.s(7, 12, pal.topShade);
      for (let y = 13; y <= 16; y++) f.s(7, y, pal.topShade);
      f.r(13, tx0 + 1, tx0 + 2, pal.topShade);
      f.s(tx1 - 1, 13, '#d9c06a');
      f.s(tx0 + 1, 14, '#f1f1f1');
    }
    f.r(17, tx0, tx1, '#15161a');
    if (!back) f.r(17, 7, 8, '#b7a15a');
    f.s(tx1, 18, '#15161a');
  } else if (o === 'tshirt' || o === 'apron') {
    if (!back) f.r(11, 6, 9, pal.topShade);
    if (o === 'apron' && !back) {
      f.s(6, 11, '#e5dfd1');
      f.s(9, 11, '#e5dfd1');
      f.s(6, 12, '#e5dfd1');
      f.s(9, 12, '#e5dfd1');
    }
    if (o === 'apron' && back) {
      f.r(15, tx0, tx1, '#e5dfd1');
    }
    f.r(17, tx0, tx1, '#1a1b1f');
  } else if (o === 'vest') {
    if (!back) {
      for (let y = 11; y <= 14; y++) f.r(y, 7, 8, '#cfd2d4');
      f.s(7, 15, '#cfd2d4');
      f.r(16, tx0, tx1, pal.topShade);
    }
  }

  /* Neck */
  f.r(10, 7, 8, pal.skinShade);

  /* Head */
  drawHeadFrontBack(f, look, pal, back);
}

function drawHeadFrontBack(f: Fig, look: CharacterLook, pal: Palette, back: boolean) {
  const female = look.body === 'female';
  const H = pal.hair;
  const HS = pal.hairShade;
  const HL = pal.hairLight;
  const hs = look.hairStyle;

  // Long hair falls behind the shoulders (drawn before the face).
  if ((hs === 'long' || (hs === 'curly' && female)) && !back) {
    for (let y = 5; y <= 13; y++) {
      f.s(4, y, HS);
      f.s(11, y, HS);
      if (y >= 8) {
        f.s(3, y, y === 13 ? HS : H);
        f.s(12, y, y === 13 ? HS : H);
      }
    }
  }

  // Face shape.
  f.r(3, 5, 10, pal.skin);
  for (let y = 4; y <= 8; y++) f.r(y, 5, 10, pal.skin);
  f.r(9, 6, 9, pal.skin);
  f.s(10, 8, pal.skinShade);
  f.s(10, 7, pal.skinShade);
  f.s(9, 9, pal.skinShade);
  // Ears.
  f.s(4, 6, pal.skinShade);
  f.s(11, 6, pal.skinShade);
  f.s(4, 7, pal.skinDark);
  f.s(11, 7, pal.skinDark);

  if (back) {
    // Back of the head: hair everywhere.
    const top = hs === 'bald' ? pal.skin : H;
    if (hs === 'bald') {
      for (let y = 3; y <= 8; y++) f.r(y, 5, 10, pal.skin);
      f.r(9, 6, 9, pal.skinShade);
      f.r(7, 5, 10, H === pal.skin ? pal.skinShade : mix(H, pal.skin, 0.4));
      f.s(6, 4, shade(pal.skin, 0.2));
    } else {
      f.r(2, 6, 9, top);
      for (let y = 3; y <= 8; y++) f.r(y, 5, 10, top);
      f.r(9, 6, 9, hs === 'buzz' || hs === 'short' ? pal.skinShade : top);
      f.s(6, 3, HL);
      f.s(7, 3, HL);
      for (let y = 4; y <= 8; y++) f.s(10, y, HS);
      if (hs === 'buzz') {
        for (let y = 3; y <= 8; y++) for (let x = 5; x <= 10; x++) if ((x + y) % 2 === 0) f.s(x, y, mix(H, pal.skin, 0.35));
      }
      if (hs === 'long' || (hs === 'curly' && female)) {
        for (let y = 9; y <= 13; y++) f.r(y, 4, 11, y === 13 ? HS : H);
        f.r(10, 5, 6, HL);
      }
      if (hs === 'ponytail') {
        for (let y = 9; y <= 12; y++) f.r(y, 7, 8, y === 12 ? HS : H);
        f.r(8, 7, 8, '#2a2a33');
      }
      if (hs === 'bun') {
        f.r(1, 6, 9, H);
        f.r(0, 7, 8, H);
        f.r(2, 6, 9, HS);
        f.s(7, 1, HL);
      }
      if (hs === 'curly') {
        f.r(1, 5, 10, H);
        f.s(4, 3, H);
        f.s(11, 3, H);
        f.s(4, 5, H);
        f.s(11, 5, H);
        for (let y = 2; y <= 8; y++) for (let x = 5; x <= 10; x++) if ((x * 3 + y * 5) % 4 === 0) f.s(x, y, HL);
      }
    }
    if (look.cap) drawCapFront(f, true);
    return;
  }

  // Eyes and brows.
  const browC = hs === 'bald' ? pal.skinDark : HS;
  f.s(6, 5, browC);
  f.s(9, 5, browC);
  f.s(6, 6, EYE);
  f.s(9, 6, EYE);
  if (female) {
    f.s(5, 6, mix(pal.skin, EYE, 0.5));
    f.s(10, 6, mix(pal.skin, EYE, 0.5));
  }
  f.s(8, 7, pal.skinShade);
  f.r(8, 7, 8, female ? mix(pal.skin, '#a8424a', 0.55) : pal.lip);

  // Hair on top.
  switch (hs) {
    case 'short':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 4, 11, H);
      f.r(4, 4, 5, H);
      f.r(4, 9, 11, H);
      f.s(4, 5, HS);
      f.s(11, 5, HS);
      f.s(7, 2, HL);
      f.s(8, 2, HL);
      f.s(6, 3, HL);
      break;
    case 'buzz':
      f.r(2, 6, 9, H);
      f.r(3, 5, 10, mix(H, pal.skin, 0.3));
      f.s(5, 4, mix(H, pal.skin, 0.45));
      f.s(10, 4, mix(H, pal.skin, 0.45));
      for (let x = 5; x <= 10; x += 2) f.s(x, 3, H);
      break;
    case 'long':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 4, 11, H);
      f.r(4, 4, 6, H);
      f.r(4, 9, 11, H);
      f.s(7, 4, H);
      f.s(6, 2, HL);
      f.s(7, 2, HL);
      f.s(5, 3, HL);
      for (let y = 5; y <= 7; y++) {
        f.s(4, y, H);
        f.s(11, y, H);
      }
      break;
    case 'ponytail':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 4, 11, H);
      f.s(4, 4, H);
      f.s(11, 4, H);
      f.s(5, 4, HS);
      f.s(10, 4, HS);
      f.s(7, 2, HL);
      f.s(12, 5, H);
      f.s(12, 6, HS);
      break;
    case 'curly':
      f.r(0, 6, 9, H);
      f.r(1, 4, 11, H);
      f.r(2, 3, 12, H);
      f.r(3, 3, 12, H);
      f.r(4, 3, 5, H);
      f.r(4, 10, 12, H);
      f.s(3, 5, H);
      f.s(12, 5, H);
      for (let y = 0; y <= 4; y++) for (let x = 3; x <= 12; x++) if ((x * 3 + y * 5) % 4 === 0 && y < 4) f.s(x, y, HL);
      f.s(7, 4, HS);
      break;
    case 'bun':
      f.r(0, 7, 8, H);
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 4, 11, H);
      f.s(4, 4, H);
      f.s(11, 4, H);
      f.s(7, 0, HL);
      f.r(2, 6, 9, HS);
      f.s(6, 3, HL);
      break;
    case 'bald':
      f.r(2, 6, 9, pal.skin);
      f.s(6, 2, shade(pal.skin, 0.25));
      f.s(4, 5, H === '#bdb6ad' ? H : mix(H, pal.skin, 0.3));
      f.s(11, 5, H === '#bdb6ad' ? H : mix(H, pal.skin, 0.3));
      break;
  }

  // Beard frames the mouth.
  if (look.beard) {
    const B = mix(H, pal.skinDark, 0.25);
    f.s(5, 7, B);
    f.s(10, 7, B);
    f.r(8, 5, 6, B);
    f.r(8, 9, 10, B);
    f.r(9, 6, 9, B);
    f.s(7, 7, mix(B, pal.skin, 0.4));
    f.s(9, 7, mix(B, pal.skin, 0.4));
  }

  // Glasses sit exactly on the eye row.
  if (look.glasses) {
    const fr = '#20232b';
    f.s(5, 6, fr);
    f.s(7, 6, fr);
    f.s(8, 6, fr);
    f.s(10, 6, fr);
    f.s(6, 7, mix(pal.skin, fr, 0.45));
    f.s(9, 7, mix(pal.skin, fr, 0.45));
  }

  if (look.cap) drawCapFront(f, false);
}

function drawCapFront(f: Fig, back: boolean) {
  const navy = '#1a2338';
  f.r(0, 6, 9, navy);
  f.r(1, 5, 10, navy);
  f.r(2, 4, 11, navy);
  f.r(3, 4, 11, back ? navy : '#0f1424');
  if (!back) {
    f.r(1, 7, 8, '#c9a54a');
    f.r(4, 5, 10, '#0b0e18');
  }
  f.s(6, 1, '#2c3a58');
}

/* ------------------------------------------------------------------ */
/* Side view (facing right)                                            */
/* ------------------------------------------------------------------ */

function drawSide(f: Fig, look: CharacterLook, pal: Palette, frame: number) {
  const female = look.body === 'female';
  const st = outfitStyle(look, pal);
  const H = pal.hair;
  const HS = pal.hairShade;
  const HL = pal.hairLight;
  const hs = look.hairStyle;

  // Leg offsets at the foot per frame: [near, far]
  const stride = frame === 1 ? [2, -2] : frame === 3 ? [-2, 2] : [0, 0];

  const leg = (off: number, far: boolean) => {
    const c = far ? pal.pantsShade : pal.pants;
    for (let y = 18; y <= 21; y++) {
      const t = (y - 17) / 5;
      const x = 7 + Math.round(off * t);
      f.r(y, x, x + 1, c);
    }
    const sx = 7 + off;
    f.r(22, sx, sx + 2, far ? '#121114' : SHOE);
    f.r(23, sx, sx + 2, far ? '#121114' : shade(SHOE, 0.1));
  };
  leg(stride[1], true);
  leg(stride[0], false);

  if (st.longCoat) {
    for (let y = 18; y <= 20; y++) f.r(y, 6, 10, y === 20 ? '#c3c9d1' : st.longCoat);
  }
  if (look.outfit === 'apron') {
    for (let y = 13; y <= 20; y++) f.s(10, y, '#e5dfd1');
    f.s(11, 18, '#e5dfd1');
  }

  // Ponytail / long hair behind the body.
  if (hs === 'long' || (hs === 'curly' && female)) {
    for (let y = 4; y <= 13; y++) f.r(y, 4, 6, y >= 12 ? HS : H);
  }
  if (hs === 'ponytail') {
    for (let y = 4; y <= 10; y++) f.r(y, 3, 4, y > 8 ? HS : H);
    f.s(5, 4, H);
  }

  // Torso.
  for (let y = 11; y <= 17; y++) f.r(y, 6, 10, pal.top);
  if (female) f.s(10, 13, pal.topLight);
  for (let y = 11; y <= 17; y++) f.s(6, y, pal.topShade);
  f.r(17, 6, 10, pal.topShade);
  const o = look.outfit;
  if (o === 'labcoat') {
    for (let y = 11; y <= 17; y++) f.r(y, 6, 10, st.longCoat!);
    for (let y = 11; y <= 17; y++) f.s(6, y, '#c3c9d1');
    f.s(10, 11, pal.top);
    f.s(10, 12, pal.top);
  } else if (o === 'blazer' || o === 'suit') {
    f.s(10, 11, WHITE_SHIRT);
    f.s(10, 12, o === 'suit' ? '#6b1d27' : WHITE_SHIRT);
    if (o === 'suit') f.s(10, 13, '#6b1d27');
    f.r(18, 6, 10, pal.topShade);
  } else if (o === 'leather') {
    f.s(10, 11, pal.topLight);
    f.s(9, 11, pal.topLight);
    f.r(17, 6, 10, shade(pal.top, -0.4));
  } else if (o === 'hoodie') {
    f.r(11, 5, 7, pal.topShade);
    f.r(12, 5, 6, pal.topShade);
    f.s(10, 12, '#d9d6cf');
  } else if (o === 'uniform') {
    f.r(11, 7, 9, '#1c2740');
    f.r(17, 6, 10, '#15161a');
    f.s(6, 18, '#15161a');
    f.s(10, 13, '#d9c06a');
  } else if (o === 'tshirt' || o === 'apron') {
    f.r(17, 6, 10, '#1a1b1f');
    if (o === 'apron') f.s(9, 11, '#e5dfd1');
  } else if (o === 'vest') {
    f.s(10, 11, '#cfd2d4');
    f.s(10, 12, '#cfd2d4');
  }

  // Near arm swings with the stride.
  const armPts: [number, number][] =
    frame === 1
      ? [[8, 12], [9, 13], [9, 14], [10, 15], [10, 16]]
      : frame === 3
        ? [[7, 12], [7, 13], [6, 14], [6, 15], [5, 16]]
        : [[8, 12], [8, 13], [8, 14], [8, 15], [8, 16]];
  armPts.forEach(([x, y], i) => {
    const c = st.shortSleeves && i >= 2 ? pal.skin : i === 0 ? st.sleeve : st.sleeve;
    f.s(x, y, c);
    f.s(x + 1, y, st.shortSleeves && i >= 2 ? pal.skinShade : st.sleeveShade);
  });
  const hand = armPts[armPts.length - 1];
  f.s(hand[0], hand[1] + 1, pal.skin);
  f.s(hand[0] + 1, hand[1] + 1, pal.skinShade);

  // Neck and head.
  f.r(10, 7, 8, pal.skinShade);
  for (let y = 3; y <= 8; y++) f.r(y, 6, 10, pal.skin);
  f.r(9, 7, 9, pal.skin);
  f.s(11, 6, pal.skin); // nose
  f.s(11, 7, pal.skinShade);
  f.s(10, 8, female ? mix(pal.skin, '#a8424a', 0.5) : pal.lip);
  f.s(9, 5, hs === 'bald' ? pal.skinDark : HS);
  f.s(9, 6, EYE);
  f.s(7, 6, pal.skinShade); // ear
  f.s(7, 7, pal.skinDark);
  f.s(6, 9, pal.skinShade);

  switch (hs) {
    case 'short':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 5, 10, H);
      f.r(4, 5, 7, H);
      f.s(10, 4, H);
      f.r(5, 5, 6, H);
      f.s(6, 6, HS);
      f.r(2, 7, 8, HL);
      break;
    case 'buzz':
      f.r(2, 6, 9, H);
      f.r(3, 5, 10, mix(H, pal.skin, 0.3));
      f.r(4, 5, 6, mix(H, pal.skin, 0.4));
      f.s(5, 5, mix(H, pal.skin, 0.4));
      break;
    case 'long':
    case 'ponytail':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 5, 10, H);
      f.r(4, 5, 7, H);
      f.s(10, 4, H);
      f.r(5, 5, 6, H);
      f.r(6, 5, 6, H);
      f.r(2, 7, 8, HL);
      break;
    case 'curly':
      f.r(0, 6, 9, H);
      f.r(1, 4, 10, H);
      f.r(2, 4, 11, H);
      f.r(3, 4, 10, H);
      f.r(4, 4, 7, H);
      f.r(5, 4, 6, H);
      f.r(6, 4, 6, H);
      f.s(10, 4, H);
      for (let y = 0; y <= 6; y++) for (let x = 4; x <= 11; x++) if ((x * 3 + y * 5) % 4 === 0 && (y < 3 || x < 7)) f.s(x, y, HL);
      break;
    case 'bun':
      f.r(1, 6, 9, H);
      f.r(2, 5, 10, H);
      f.r(3, 5, 10, HS);
      f.r(4, 5, 6, H);
      f.s(10, 4, H);
      f.r(2, 3, 4, H);
      f.r(3, 3, 4, H);
      f.s(3, 1, H);
      f.s(4, 1, HL);
      break;
    case 'bald':
      f.r(2, 7, 9, pal.skin);
      f.s(8, 2, shade(pal.skin, 0.25));
      f.r(5, 5, 6, mix(H, pal.skin, 0.35));
      break;
  }

  if (look.beard) {
    const B = mix(H, pal.skinDark, 0.25);
    f.s(8, 8, B);
    f.s(9, 8, B);
    f.r(9, 7, 9, B);
    f.s(10, 9, B);
    f.s(11, 8, mix(B, pal.skin, 0.5));
  }

  if (look.glasses) {
    const fr = '#20232b';
    f.r(6, 7, 8, fr);
    f.s(10, 6, fr);
    f.s(10, 5, fr);
    f.s(9, 5, fr);
  }

  if (look.cap) {
    const navy = '#1a2338';
    f.r(0, 6, 9, navy);
    f.r(1, 5, 10, navy);
    f.r(2, 5, 10, navy);
    f.r(3, 5, 10, '#0f1424');
    f.r(4, 9, 12, '#0b0e18');
    f.s(9, 1, '#c9a54a');
  }
}

/* ------------------------------------------------------------------ */
/* Sheet assembly                                                      */
/* ------------------------------------------------------------------ */

const sheetCache = new Map<string, HTMLCanvasElement>();

export function lookKey(look: CharacterLook): string {
  return [look.body, look.skin, look.hairStyle, look.hairColor, look.outfit, look.topColor, look.pantsColor, look.beard ? 1 : 0, look.glasses ? 1 : 0, look.cap ? 1 : 0].join('|');
}

/** Paint a full 4x4 sheet into a pixel buffer (no DOM needed). */
export function paintSheet(look: CharacterLook): PixelBuffer {
  const p = new PixelBuffer(FRAME_W * 4, FRAME_H * 4);
  const pal = paletteFor(look);
  for (let frame = 0; frame < 4; frame++) {
    const ox = frame * FRAME_W + 1;
    drawFrontBack(new Fig(p, ox, DIR_DOWN * FRAME_H + 2), look, pal, 'down', frame);
    drawSide(new Fig(p, ox, DIR_RIGHT * FRAME_H + 2), look, pal, frame);
    drawFrontBack(new Fig(p, ox, DIR_UP * FRAME_H + 2), look, pal, 'up', frame);
  }
  // Left = mirrored right.
  for (let frame = 0; frame < 4; frame++) {
    p.mirrorFrom(p, frame * FRAME_W, DIR_RIGHT * FRAME_H, FRAME_W, FRAME_H, frame * FRAME_W, DIR_LEFT * FRAME_H);
  }
  for (let d = 0; d < 4; d++)
    for (let frame = 0; frame < 4; frame++) p.outline(OUTLINE, frame * FRAME_W, d * FRAME_H, FRAME_W, FRAME_H);
  return p;
}

export function characterSheet(look: CharacterLook): HTMLCanvasElement {
  const key = lookKey(look);
  let c = sheetCache.get(key);
  if (!c) {
    c = paintSheet(look).toCanvas();
    sheetCache.set(key, c);
  }
  return c;
}

/** Walk cycle frame order: stand, step, stand, step. */
export function walkFrame(t: number, moving: boolean): number {
  if (!moving) return 0;
  return Math.floor(t * 8) % 4;
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  look: CharacterLook,
  x: number,
  y: number,
  dir: Dir,
  frame: number,
) {
  const sheet = characterSheet(look);
  ctx.drawImage(sheet, frame * FRAME_W, dir * FRAME_H, FRAME_W, FRAME_H, Math.round(x - FOOT_X), Math.round(y - FOOT_Y), FRAME_W, FRAME_H);
}
