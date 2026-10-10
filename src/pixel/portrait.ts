// 40x40 pixel-art bust portraits for conversations and the interrogation room.
import type { CharacterLook } from '../types/investigation';
import { PixelBuffer, mix, shade } from './color';
import { paletteFor } from './sprites';

export const PORTRAIT_SIZE = 40;

export type Expression = 'neutral' | 'smile' | 'tense' | 'defiant' | 'broken';

export interface PortraitPose {
  expression?: Expression;
  mouthOpen?: boolean;
  blink?: boolean;
  /** Back of the head (the detective seen from behind). */
  back?: boolean;
}

const OUTLINE = '#0d1117';
const EYE_DARK = '#17161d';
const SHIRT = '#e9e7e1';

function faceSpan(y: number, female: boolean): [number, number] | null {
  if (y < 5 || y > 27) return null;
  if (y === 5) return [15, 24];
  if (y === 6) return [14, 25];
  if (y === 7) return [13, 26];
  if (y <= 22) return [12, 27];
  const male: Record<number, [number, number]> = { 23: [13, 26], 24: [13, 26], 25: [14, 25], 26: [15, 24], 27: [17, 22] };
  const fem: Record<number, [number, number]> = { 23: [13, 26], 24: [14, 25], 25: [15, 24], 26: [16, 23], 27: [18, 21] };
  return (female ? fem : male)[y];
}

export function paintPortrait(look: CharacterLook, pose: PortraitPose = {}): PixelBuffer {
  const p = new PixelBuffer(PORTRAIT_SIZE, PORTRAIT_SIZE);
  const pal = paletteFor(look);
  const female = look.body === 'female';
  const back = !!pose.back;
  const ex = pose.expression ?? 'neutral';
  const H = pal.hair;
  const HS = pal.hairShade;
  const hs = look.hairStyle;
  const set = (x: number, y: number, c: string) => p.set(x, y, c);
  const row = (y: number, x0: number, x1: number, c: string) => p.row(y, x0, x1, c);

  /* Long hair behind the shoulders */
  if (hs === 'long' || (hs === 'curly' && female)) {
    for (let y = 8; y <= 35; y++) {
      const w = y > 30 ? 3 : 4;
      row(y, 9, 9 + w, y > 33 ? HS : H);
      row(y, 30 - w, 30, y > 33 ? HS : H);
    }
  }
  if (hs === 'ponytail' && !back) {
    for (let y = 9; y <= 24; y++) row(y, 28, 30, y > 20 ? HS : H);
  }

  /* Shoulders and outfit */
  const shoulder = (y: number): [number, number] | null => {
    if (y < 29) return null;
    if (y === 29) return [12, 27];
    if (y === 30) return [8, 31];
    if (y === 31) return [5, 34];
    return [3, 36];
  };
  const o = look.outfit;
  const coat = o === 'labcoat' ? '#eef0f2' : pal.top;
  const coatShade = o === 'labcoat' ? '#c3c9d1' : pal.topShade;
  for (let y = 29; y < 40; y++) {
    const s = shoulder(y)!;
    row(y, s[0], s[1], coat);
    row(y, s[1] - 3, s[1], coatShade);
    set(s[0], y, mix(coat, coatShade, 0.5));
  }
  if (o === 'hoodie') {
    // Hood bunched around the neck.
    for (let y = 26; y <= 31; y++) row(y, 11, 28, y < 28 ? pal.topShade : shade(pal.top, -0.15));
  }

  /* Neck */
  for (let y = 25; y <= 31; y++) row(y, 16, 23, y < 28 ? pal.skinShade : pal.skin);
  row(25, 16, 23, pal.skinDark);

  if (!back) {
    if (o === 'tshirt' || o === 'apron') {
      row(31, 15, 24, pal.topShade);
      row(32, 16, 23, pal.topShade);
      for (let y = 29; y <= 31; y++) row(y, 15, 24, y === 31 ? pal.topShade : pal.skin);
      row(31, 15, 24, pal.topShade);
      if (o === 'apron') {
        const ap = '#e5dfd1';
        for (let y = 30; y <= 34; y++) {
          row(y, 12, 13, ap);
          row(y, 26, 27, ap);
        }
        for (let y = 34; y < 40; y++) row(y, 12, 27, y === 34 ? shade(ap, -0.1) : ap);
      }
    } else if (o === 'uniform') {
      const navy = '#1c2740';
      for (let y = 29; y <= 33; y++) row(y, 18 - (33 - y) / 2, 21 + (33 - y) / 2, pal.skin);
      row(32, 19, 20, '#1d2230');
      row(33, 19, 20, '#1d2230');
      // Collar points.
      for (let i = 0; i < 4; i++) {
        row(29 + i, 13 + i, 17, pal.topLight);
        row(29 + i, 22, 26 - i, shade(pal.top, 0.05));
      }
      // Epaulettes with rank bars.
      for (let y = 31; y <= 33; y++) {
        row(y, 4, 11, navy);
        row(y, 28, 35, navy);
      }
      for (let y = 31; y <= 33; y++) {
        set(6, y, '#c9a54a');
        set(8, y, '#c9a54a');
        set(31, y, '#c9a54a');
        set(33, y, '#c9a54a');
      }
      row(36, 8, 15, pal.topShade);
      row(36, 24, 31, pal.topShade);
      row(35, 26, 29, '#d9c06a');
      row(36, 27, 28, '#b8992f');
      row(37, 27, 28, '#d9c06a');
      row(35, 10, 14, '#f1f1f1');
      for (let y = 34; y < 40; y++) set(19, y, pal.topShade);
    } else if (o === 'blazer' || o === 'suit' || o === 'labcoat') {
      const inner = o === 'labcoat' ? pal.top : SHIRT;
      for (let y = 29; y < 40; y++) {
        const half = Math.max(1, Math.round(5 - (y - 29) * 0.4));
        row(y, 19 - half + 1, 20 + half - 1, inner);
      }
      // Shirt collar points.
      row(29, 15, 17, inner);
      row(30, 15, 17, inner);
      row(29, 22, 24, inner);
      row(30, 22, 24, inner);
      if (o === 'suit') {
        row(30, 19, 20, '#7d2330');
        row(31, 19, 20, '#6b1d27');
        for (let y = 32; y < 40; y++) row(y, 18 + (y > 34 ? 0 : 1), 21 - (y > 34 ? 0 : 1), y % 3 === 0 ? '#8a2a38' : '#6b1d27');
      } else {
        row(29, 18, 21, pal.skin);
        set(19, 30, pal.skin);
        set(20, 30, pal.skin);
      }
      // Lapels.
      const lap = o === 'labcoat' ? '#d5dade' : pal.topLight;
      for (let y = 31; y < 40; y++) {
        const half = Math.max(1, Math.round(5 - (y - 29) * 0.4));
        set(19 - half, y, lap);
        set(20 + half, y, shade(lap, -0.2));
      }
      if (o === 'labcoat') {
        row(34, 27, 27, '#2563eb');
        set(27, 35, '#2563eb');
        row(36, 25, 30, '#c3c9d1');
      }
    } else if (o === 'leather') {
      for (let y = 29; y < 40; y++) row(y, 17, 22, '#b3ada1');
      for (let y = 29; y <= 30; y++) row(y, 17, 22, pal.skin);
      for (let i = 0; i < 6; i++) {
        row(29 + i, 10 + i, 16, pal.topLight);
        row(29 + i, 23, 29 - i, shade(pal.top, 0.08));
      }
      for (let y = 34; y < 40; y++) {
        set(16, y, '#8d8f96');
        set(23, y, '#8d8f96');
      }
    } else if (o === 'hoodie') {
      for (let y = 29; y <= 30; y++) row(y, 17, 22, pal.skin);
      for (let y = 31; y <= 37; y++) {
        set(17, y, '#d9d6cf');
        set(22, y, '#d9d6cf');
      }
      set(17, 38, '#a7a39b');
      set(22, 38, '#a7a39b');
    } else if (o === 'vest') {
      for (let y = 29; y < 40; y++) row(y, 15, 24, '#cfd2d4');
      for (let y = 29; y <= 30; y++) row(y, 17, 22, pal.skin);
      for (let y = 31; y < 40; y++) {
        const half = Math.max(1, Math.round(5 - (y - 29) * 0.45));
        row(y, 3, 19 - half, y < 32 ? '#cfd2d4' : pal.top);
        row(y, 20 + half, 36, y < 32 ? '#cfd2d4' : pal.top);
      }
      row(35, 22, 23, '#c9a54a');
    }
  } else {
    // Back: collar line and plain fabric.
    row(29, 14, 25, coatShade);
    if (o === 'hoodie') for (let y = 29; y <= 34; y++) row(y, 13, 26, pal.topShade);
  }

  /* Head */
  for (let y = 5; y <= 27; y++) {
    const s = faceSpan(y, female)!;
    row(y, s[0], s[1], pal.skin);
    set(s[1], y, pal.skinShade);
    if (y > 8) set(s[1] - 1, y, mix(pal.skin, pal.skinShade, 0.5));
  }
  for (let y = 23; y <= 27; y++) {
    const s = faceSpan(y, female)!;
    set(s[0], y, pal.skinShade);
  }
  // Ears.
  for (let y = 15; y <= 20; y++) {
    row(y, 10, 11, y === 15 || y === 20 ? pal.skinShade : pal.skin);
    row(y, 28, 29, pal.skinShade);
  }
  set(11, 17, pal.skinDark);
  set(28, 17, pal.skinDark);

  if (back) {
    paintHairBack(p, look, pal);
    if (look.cap) paintCap(p, true);
    p.outline(OUTLINE);
    return p;
  }

  /* Eyes */
  const eyeRow = 16;
  const look2 = ex === 'broken' ? 1 : 0;
  const eye = (x0: number, mirror: boolean) => {
    const xs = mirror ? [x0 + 3, x0 + 2, x0 + 1, x0] : [x0, x0 + 1, x0 + 2, x0 + 3];
    if (pose.blink) {
      row(eyeRow + 1, x0, x0 + 3, EYE_DARK);
      return;
    }
    row(eyeRow, x0, x0 + 3, EYE_DARK);
    set(xs[0], eyeRow + 1, '#e9e4dc');
    set(xs[1], eyeRow + 1 + look2, '#3a2a20');
    set(xs[2], eyeRow + 1 + look2, EYE_DARK);
    set(xs[3], eyeRow + 1, '#d9d3ca');
    if (look2) {
      set(xs[1], eyeRow + 1, mix(pal.skin, EYE_DARK, 0.6));
      set(xs[2], eyeRow + 1, mix(pal.skin, EYE_DARK, 0.6));
    }
    if (ex === 'tense') row(eyeRow + 2, x0, x0 + 3, mix(pal.skin, '#d9d3ca', 0.4));
    else row(eyeRow + 2, x0, x0 + 3, pal.skinShade);
    if (female) set(xs[3] + (mirror ? -1 : 1), eyeRow, EYE_DARK);
  };
  eye(14, false);
  eye(22, true);

  /* Brows */
  const brow = look.hairStyle === 'bald' || look.hairColor === '#bdb6ad' ? mix(H, pal.skinDark, 0.5) : HS;
  const browPair = (pts: [number, number][]) => {
    for (const [x, y] of pts) {
      set(x, y, brow);
      set(39 - x, y, brow);
    }
  };
  if (ex === 'defiant') browPair([[14, 12], [15, 13], [16, 13], [17, 14]]);
  else if (ex === 'tense' || ex === 'broken') browPair([[14, 14], [15, 13], [16, 13], [17, 12]]);
  else browPair([[14, 13], [15, 13], [16, 13], [17, 13]]);
  if (!female) browPair([[15, 14], [16, 14]].map(([x, y]) => [x, ex === 'defiant' ? y : y - (ex === 'neutral' || ex === 'smile' ? 0 : 1)] as [number, number]));

  /* Nose */
  for (let y = 18; y <= 20; y++) set(20, y, pal.skinShade);
  set(18, 21, pal.skinDark);
  set(21, 21, pal.skinDark);
  row(21, 19, 20, pal.skinShade);
  set(19, 20, shade(pal.skin, 0.12));

  /* Mouth */
  const lip = female ? mix(pal.skin, '#a8424a', 0.6) : pal.lip;
  const dark = '#3a1c1f';
  if (pose.mouthOpen) {
    row(23, 17, 22, lip);
    row(24, 17, 22, dark);
    row(25, 18, 21, dark);
    row(24, 18, 21, ex === 'broken' ? dark : '#ddd5cc');
    row(26, 18, 21, lip);
  } else if (ex === 'smile') {
    set(16, 23, lip);
    set(23, 23, lip);
    row(24, 17, 22, dark);
    row(25, 18, 21, lip);
  } else if (ex === 'defiant') {
    row(24, 17, 21, dark);
    set(22, 23, dark);
    row(25, 18, 20, lip);
  } else if (ex === 'broken' || ex === 'tense') {
    row(24, 17, 22, dark);
    set(16, 25, dark);
    set(23, 25, dark);
    row(25, 18, 21, lip);
  } else {
    row(24, 17, 22, dark);
    row(25, 18, 21, lip);
  }
  if (female) {
    set(14, 21, mix(pal.skin, '#d2706f', 0.25));
    set(25, 21, mix(pal.skin, '#d2706f', 0.25));
  }

  /* Facial hair */
  if (look.beard) {
    const B = mix(H, pal.skinDark, 0.2);
    const B2 = mix(B, pal.skin, 0.35);
    for (let y = 20; y <= 28; y++) {
      const s = faceSpan(Math.min(y, 27), female) ?? [17, 22];
      for (let x = s[0]; x <= s[1]; x++) {
        const inMouth = y >= 23 && y <= 25 && x >= 17 && x <= 22;
        const cheek = y < 22 && (x > 15 && x < 24);
        if (inMouth || cheek) continue;
        if (y < 22 && x > 13 && x < 26) continue;
        set(x, y, (x + y) % 3 === 0 ? B2 : B);
      }
    }
    row(22, 16, 23, B);
    row(28, 17, 22, B);
  }

  /* Hair */
  paintHairFront(p, look, pal);

  /* Glasses on the eye line */
  if (look.glasses) {
    const fr = '#1d2028';
    const lens = (x0: number) => {
      row(14, x0, x0 + 5, fr);
      row(19, x0, x0 + 5, fr);
      for (let y = 15; y <= 18; y++) {
        set(x0, y, fr);
        set(x0 + 5, y, fr);
      }
      set(x0 + 1, 15, '#c8dcef');
    };
    lens(13);
    lens(21);
    row(16, 19, 20, fr);
    row(15, 10, 12, fr);
    row(15, 27, 29, fr);
  }

  if (look.cap) paintCap(p, false);

  /* Expression extras */
  if (ex === 'tense') {
    set(28, 11, '#cfe8ff');
    set(28, 12, '#9fc9f0');
    set(29, 12, '#cfe8ff');
    set(28, 13, '#7fb1e0');
  }
  if (ex === 'broken') {
    set(15, 19, '#a9d4ff');
    set(15, 20, '#7fb1e0');
    set(15, 21, '#a9d4ff');
  }

  p.outline(OUTLINE);
  return p;
}

function paintHairFront(p: PixelBuffer, look: CharacterLook, pal: ReturnType<typeof paletteFor>) {
  const H = pal.hair;
  const HS = pal.hairShade;
  const HL = pal.hairLight;
  const set = (x: number, y: number, c: string) => p.set(x, y, c);
  const row = (y: number, x0: number, x1: number, c: string) => p.row(y, x0, x1, c);
  const female = look.body === 'female';
  switch (look.hairStyle) {
    case 'short': {
      row(3, 15, 24, H);
      row(4, 13, 26, H);
      row(5, 12, 27, H);
      for (let y = 6; y <= 9; y++) row(y, 11, 28, H);
      row(10, 11, 19, H);
      row(10, 25, 28, H);
      row(11, 11, 15, H);
      row(11, 26, 28, H);
      for (let y = 12; y <= 16; y++) {
        row(y, 11, 12, H);
        row(y, 27, 28, HS);
      }
      row(4, 16, 21, HL);
      row(5, 15, 18, HL);
      row(6, 14, 16, HL);
      for (let x = 20; x <= 27; x++) set(x, 9, HS);
      set(19, 10, HS);
      break;
    }
    case 'buzz': {
      const b = mix(H, pal.skin, 0.25);
      row(5, 14, 25, b);
      for (let y = 6; y <= 9; y++) row(y, 12, 27, b);
      row(10, 12, 13, b);
      row(10, 26, 27, b);
      for (let y = 11; y <= 14; y++) {
        set(12, y, b);
        set(27, y, b);
      }
      for (let y = 5; y <= 9; y++) for (let x = 12; x <= 27; x++) if ((x + y) % 2 === 0) set(x, y, H);
      row(9, 13, 26, mix(H, pal.skin, 0.5));
      break;
    }
    case 'long': {
      row(2, 15, 24, H);
      row(3, 13, 26, H);
      row(4, 11, 28, H);
      for (let y = 5; y <= 9; y++) row(y, 10, 29, H);
      row(10, 10, 18, H);
      row(10, 23, 29, H);
      row(11, 10, 16, H);
      row(11, 26, 29, H);
      for (let y = 12; y <= 26; y++) {
        row(y, 10, 12, H);
        row(y, 27, 29, HS);
      }
      row(3, 16, 21, HL);
      row(4, 14, 18, HL);
      row(5, 13, 15, HL);
      for (let y = 12; y <= 24; y += 3) set(11, y, HL);
      set(19, 10, HS);
      set(20, 9, HS);
      break;
    }
    case 'ponytail': {
      row(3, 15, 24, H);
      row(4, 13, 26, H);
      for (let y = 5; y <= 9; y++) row(y, 12, 27, H);
      row(10, 11, 15, H);
      row(10, 24, 28, H);
      for (let y = 11; y <= 15; y++) {
        set(11, y, H);
        set(28, y, HS);
      }
      for (let x = 13; x <= 26; x += 3) set(x, 6, HL);
      row(4, 16, 20, HL);
      row(9, 18, 21, HS);
      break;
    }
    case 'curly': {
      for (let y = 1; y <= 11; y++) {
        const w = y < 3 ? 6 + y * 2 : 10;
        row(y, 20 - w, 19 + w, H);
      }
      for (let y = 12; y <= (female ? 26 : 17); y++) {
        row(y, 8, 12, H);
        row(y, 27, 31, HS);
      }
      for (let y = 1; y <= 17; y++)
        for (let x = 8; x <= 31; x++) {
          if (!p.alpha(x, y) || (y >= 11 && x >= 13 && x <= 26)) continue;
          const k = (x * 7 + y * 11) % 13;
          if (k === 0 || k === 1) set(x, y, HL);
          else if (k === 6) set(x, y, HS);
        }
      for (let x = 13; x <= 26; x++) if (x % 3 === 0) set(x, 12, H);
      set(9, 3, H);
      set(30, 3, H);
      break;
    }
    case 'bun': {
      for (let y = 0; y <= 4; y++) row(y, 16 - (y === 0 || y === 4 ? 0 : 1), 23 + (y === 0 || y === 4 ? 0 : 1), y < 2 ? HL : H);
      row(4, 13, 26, H);
      for (let y = 5; y <= 9; y++) row(y, 12, 27, H);
      row(10, 11, 14, H);
      row(10, 25, 28, H);
      for (let y = 11; y <= 14; y++) {
        set(11, y, H);
        set(28, y, HS);
      }
      for (let x = 14; x <= 26; x += 2) set(x, 7, HS);
      row(5, 14, 18, HL);
      break;
    }
    case 'bald': {
      row(6, 15, 18, shade(pal.skin, 0.22));
      row(7, 14, 16, shade(pal.skin, 0.15));
      const side = mix(H, pal.skin, 0.25);
      for (let y = 12; y <= 17; y++) {
        set(11, y, side);
        set(12, y, side);
        set(27, y, side);
        set(28, y, side);
      }
      break;
    }
  }
}

function paintHairBack(p: PixelBuffer, look: CharacterLook, pal: ReturnType<typeof paletteFor>) {
  const H = pal.hair;
  const HS = pal.hairShade;
  const HL = pal.hairLight;
  const hs = look.hairStyle;
  const female = look.body === 'female';
  if (hs === 'bald') {
    for (let y = 5; y <= 27; y++) {
      const s = faceSpan(y, female)!;
      p.row(y, s[0], s[1], y > 16 ? mix(H, pal.skin, 0.4) : pal.skin);
    }
    p.row(7, 15, 18, shade(pal.skin, 0.2));
    return;
  }
  const bottom = hs === 'long' || (hs === 'curly' && female) ? 34 : hs === 'buzz' || hs === 'short' ? 24 : 25;
  for (let y = hs === 'curly' ? 1 : 3; y <= bottom; y++) {
    const s = y < 5 ? ([15 - (y - 3), 24 + (y - 3)] as [number, number]) : faceSpan(Math.min(y, 22), female)!;
    const extra = hs === 'curly' ? 3 : hs === 'long' ? 2 : 1;
    const c = hs === 'buzz' ? mix(H, pal.skin, 0.3) : H;
    p.row(y, s[0] - extra, s[1] + extra, c);
    p.row(y, s[1], s[1] + extra, HS);
  }
  p.row(5, 16, 19, HL);
  p.row(6, 15, 17, HL);
  p.set(15, 7, HL);
  if (hs === 'bun') {
    for (let y = 8; y <= 14; y++) p.row(y, 16, 23, y < 10 ? HL : H);
  }
  if (hs === 'ponytail') {
    for (let y = 16; y <= 30; y++) p.row(y, 18, 21, y > 27 ? HS : H);
    p.row(15, 18, 21, '#2a2a33');
  }
}

function paintCap(p: PixelBuffer, back: boolean) {
  const navy = '#1a2338';
  p.row(1, 15, 24, navy);
  p.row(2, 13, 26, navy);
  for (let y = 3; y <= 8; y++) p.row(y, 11, 28, navy);
  p.row(9, 11, 28, '#0f1424');
  if (!back) {
    p.row(10, 11, 28, '#0b0e18');
    p.row(11, 13, 26, '#0b0e18');
    p.row(4, 18, 21, '#c9a54a');
    p.row(5, 18, 21, '#b8992f');
    p.row(6, 19, 20, '#c9a54a');
  }
  p.row(3, 14, 18, '#2c3a58');
}

const portraitCache = new Map<string, HTMLCanvasElement>();

export function portraitCanvas(look: CharacterLook, pose: PortraitPose = {}): HTMLCanvasElement {
  const key = JSON.stringify([look, pose.expression ?? 'neutral', !!pose.mouthOpen, !!pose.blink, !!pose.back]);
  let c = portraitCache.get(key);
  if (!c) {
    c = paintPortrait(look, pose).toCanvas();
    portraitCache.set(key, c);
  }
  return c;
}
