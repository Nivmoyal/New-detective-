// Smoothly drawn characters: drawn with canvas paths at full screen resolution,
// so they stay crisp at any size - the walking figure in the world, the
// character creator preview and the conversation portraits all use this.
import type { CharacterLook } from '../types/investigation';
import { mix, shade } from './color';

export type Dir = 0 | 1 | 2 | 3; // down, left, right, up
export const DIR_DOWN: Dir = 0;
export const DIR_LEFT: Dir = 1;
export const DIR_RIGHT: Dir = 2;
export const DIR_UP: Dir = 3;

export type Expression = 'neutral' | 'smile' | 'tense' | 'defiant' | 'broken';

export interface PersonPose {
  dir: Dir;
  /** Walk cycle phase in radians. */
  phase?: number;
  moving?: boolean;
  expression?: Expression;
  mouthOpen?: boolean;
  blink?: boolean;
  /** Extra facial detail for close-ups. */
  detail?: boolean;
}

type Ctx = CanvasRenderingContext2D;

const OL = '#151922';
const SHOE = '#1d1c21';
const SHIRT = '#ecebe6';
const NAVY = '#1b2540';
const GOLD = '#d4b04c';
const LW = 0.55;

interface Pal {
  skin: string;
  skinShade: string;
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

function pal(look: CharacterLook): Pal {
  return {
    skin: look.skin,
    skinShade: shade(look.skin, -0.16),
    hair: look.hairColor,
    hairShade: shade(look.hairColor, -0.3),
    hairLight: shade(look.hairColor, 0.25),
    top: look.topColor,
    topShade: shade(look.topColor, -0.22),
    topLight: shade(look.topColor, 0.18),
    pants: look.pantsColor,
    pantsShade: shade(look.pantsColor, -0.28),
    lip: mix(look.skin, look.body === 'female' ? '#b24a55' : '#8f4a44', look.body === 'female' ? 0.55 : 0.35),
  };
}

/* ------------------------------------------------------------------ */
/* Drawing helpers                                                     */
/* ------------------------------------------------------------------ */

function capsule(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = w + LW * 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, outline = true) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = LW;
    ctx.stroke();
  }
}

function rrectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, outline = true) {
  rrectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = LW;
    ctx.stroke();
  }
}

function poly(ctx: Ctx, pts: number[], fill: string, outline = false) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = LW;
    ctx.stroke();
  }
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Body measurements (feet at 0, units = world pixels)                 */
/* ------------------------------------------------------------------ */

const HIP = -10.5;
const SHOULDER = -19.6;
const HEAD_Y = -25.4;
const HEAD_RX = 4.3;
const HEAD_RY = 4.6;

const longSleeves = (o: CharacterLook['outfit']) => !['tshirt', 'apron', 'uniform'].includes(o);
const sleeveColor = (look: CharacterLook, p: Pal) => (look.outfit === 'labcoat' ? '#eef0f2' : look.outfit === 'vest' ? '#d3d6d9' : p.top);

/* ------------------------------------------------------------------ */
/* Hair                                                                */
/* ------------------------------------------------------------------ */

type PathFn = () => void;

/** Fill (and outline) a path built by fn. */
function shape(ctx: Ctx, fn: PathFn, fill: string, outline = true) {
  ctx.beginPath();
  fn();
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = OL;
    ctx.lineWidth = LW;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

const pt = (cx: number, cy: number, rx: number, ry: number, a: number): [number, number] => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];

/** A bumpy (curly) edge along an ellipse arc from angle a0 to a1. */
function scallop(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number, amp: number, move: boolean) {
  const [x0, y0] = pt(cx, cy, rx, ry, a0);
  if (move) ctx.moveTo(x0, y0);
  else ctx.lineTo(x0, y0);
  for (let i = 0; i < n; i++) {
    const t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    const tm = a0 + ((a1 - a0) * (i + 0.5)) / n;
    const [qx, qy] = pt(cx, cy, rx + amp * 2, ry + amp * 2, tm);
    const [x1, y1] = pt(cx, cy, rx, ry, t1);
    ctx.quadraticCurveTo(qx, qy, x1, y1);
  }
}

/** Crown of the head from the left temple over the top to the right temple. */
function crown(ctx: Ctx, hc: number, grow = 0) {
  const [lx, ly] = pt(0, hc - 0.3, HEAD_RX + 0.5 + grow, HEAD_RY + 0.45 + grow, Math.PI + 0.1);
  ctx.moveTo(lx, ly);
  ctx.ellipse(0, hc - 0.3, HEAD_RX + 0.5 + grow, HEAD_RY + 0.45 + grow, 0, Math.PI + 0.1, Math.PI * 2 - 0.1);
}

function curls(ctx: Ctx, p: Pal, pts: [number, number][]) {
  ctx.lineCap = 'round';
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, 0.45, Math.PI * 1.0, Math.PI * 1.9);
    ctx.strokeStyle = p.hairLight;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function clipHead(ctx: Ctx, cx: number, hc: number) {
  ctx.beginPath();
  ctx.ellipse(cx, hc, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
  ctx.clip();
}

/** Hair that hangs behind the head and shoulders (drawn before the body). */
function hairBehind(ctx: Ctx, look: CharacterLook, p: Pal, hc: number, side: boolean) {
  const female = look.body === 'female';
  if (look.hairStyle === 'long') {
    if (side)
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX + 0.6, hc - 2.4);
        ctx.quadraticCurveTo(-HEAD_RX - 2.0, hc + 2.5, -HEAD_RX - 0.9, hc + 8.6);
        ctx.quadraticCurveTo(-HEAD_RX + 0.6, hc + 9.0, -HEAD_RX + 2.2, hc + 8.2);
        ctx.quadraticCurveTo(-HEAD_RX + 1.6, hc + 3.5, 0.6, hc + 1.2);
      }, p.hairShade);
    else
      shape(ctx, () => {
        ctx.moveTo(-HEAD_RX - 1.1, hc - 1.2);
        ctx.quadraticCurveTo(-HEAD_RX - 1.8, hc + 4.5, -HEAD_RX - 1.0, hc + 7.8);
        ctx.quadraticCurveTo(0, hc + 8.6, HEAD_RX + 1.0, hc + 7.8);
        ctx.quadraticCurveTo(HEAD_RX + 1.8, hc + 4.5, HEAD_RX + 1.1, hc - 1.2);
      }, p.hairShade);
  }
  if (look.hairStyle === 'curly' && female) {
    ctx.beginPath();
    if (side) scallop(ctx, -1.2, hc + 2.4, 3.6, 4.6, Math.PI * 0.4, Math.PI * 1.6, 6, 0.45, true);
    else scallop(ctx, 0, hc + 1.4, HEAD_RX + 1.1, HEAD_RY + 0.6, Math.PI * -0.05, Math.PI * 1.05, 8, 0.4, true);
    ctx.closePath();
    ctx.fillStyle = p.hairShade;
    ctx.fill();
    ctx.strokeStyle = OL;
    ctx.lineWidth = LW;
    ctx.stroke();
  }
}

function hairFront(ctx: Ctx, look: CharacterLook, p: Pal, hc: number) {
  const H = p.hair;
  const female = look.body === 'female';
  const R = HEAD_RX;
  switch (look.hairStyle) {
    case 'short':
      shape(ctx, () => {
        crown(ctx, hc);
        ctx.lineTo(R + 0.25, hc - 0.2);
        ctx.lineTo(R - 0.55, hc - 0.4);
        ctx.quadraticCurveTo(R - 1.0, hc - 1.6, 1.2, hc - 2.5);
        ctx.quadraticCurveTo(0.2, hc - 2.0, -0.6, hc - 2.1);
        ctx.quadraticCurveTo(-2.6, hc - 1.9, -R + 0.55, hc - 0.4);
        ctx.lineTo(-R - 0.25, hc - 0.2);
      }, H);
      line(ctx, -1.8, hc - 3.9, 0.6, hc - 4.5, 0.55, p.hairLight);
      break;
    case 'buzz':
      shape(ctx, () => {
        crown(ctx, hc, -0.25);
        ctx.quadraticCurveTo(R - 0.5, hc - 1.3, 0, hc - 2.9);
        ctx.quadraticCurveTo(-R + 0.5, hc - 1.3, -R - 0.05, hc - 0.9);
      }, mix(H, look.skin, 0.3));
      break;
    case 'ponytail':
    case 'bun':
      if (look.hairStyle === 'bun') ell(ctx, 0, hc - HEAD_RY - 0.9, 2.0, 1.8, H);
      shape(ctx, () => {
        crown(ctx, hc);
        ctx.quadraticCurveTo(R - 0.3, hc - 1.1, R - 1.2, hc - 1.6);
        ctx.quadraticCurveTo(0, hc - 3.2, -R + 1.2, hc - 1.6);
        ctx.quadraticCurveTo(-R + 0.3, hc - 1.1, -R - 0.4, hc - 0.7);
      }, H);
      // Combed-back strands.
      line(ctx, -1.6, hc - 2.6, -1.1, hc - 4.4, 0.25, p.hairShade);
      line(ctx, 1.4, hc - 2.6, 0.9, hc - 4.4, 0.25, p.hairShade);
      line(ctx, -2.4, hc - 3.6, -0.6, hc - 4.6, 0.5, p.hairLight);
      break;
    case 'long':
      shape(ctx, () => {
        ctx.moveTo(0, hc - HEAD_RY - 0.75);
        ctx.bezierCurveTo(-R - 1.0, hc - HEAD_RY - 0.6, -R - 1.6, hc - 2.5, -R - 1.3, hc + 1.5);
        ctx.quadraticCurveTo(-R - 1.2, hc + 5, -R - 0.6, hc + 6.8);
        ctx.quadraticCurveTo(-R + 0.3, hc + 6.6, -R + 0.6, hc + 5.6);
        ctx.quadraticCurveTo(-R + 0.2, hc + 1.0, -R + 1.0, hc - 1.3);
        ctx.quadraticCurveTo(-2.0, hc - 2.6, -0.3, hc - 2.5);
        ctx.lineTo(0.2, hc - 3.1);
        ctx.quadraticCurveTo(2.4, hc - 2.5, R - 1.0, hc - 1.3);
        ctx.quadraticCurveTo(R - 0.2, hc + 1.0, R - 0.6, hc + 5.6);
        ctx.quadraticCurveTo(R - 0.3, hc + 6.6, R + 0.6, hc + 6.8);
        ctx.quadraticCurveTo(R + 1.2, hc + 5, R + 1.3, hc + 1.5);
        ctx.bezierCurveTo(R + 1.6, hc - 2.5, R + 1.0, hc - HEAD_RY - 0.6, 0, hc - HEAD_RY - 0.75);
      }, H);
      line(ctx, 0.2, hc - 3.1, 0.1, hc - HEAD_RY - 0.5, 0.3, p.hairShade);
      line(ctx, -R - 0.4, hc + 1.0, -R, hc + 5.0, 0.25, p.hairShade);
      line(ctx, R + 0.4, hc + 1.0, R, hc + 5.0, 0.25, p.hairShade);
      line(ctx, -2.6, hc - 3.8, -1.0, hc - 4.6, 0.55, p.hairLight);
      break;
    case 'curly': {
      const low = female ? 0.7 : 0.15;
      shape(ctx, () => {
        scallop(ctx, 0, hc - 0.7, R + 0.9, HEAD_RY + 0.7, Math.PI - low, Math.PI * 2 + low, female ? 12 : 9, 0.45, true);
        // Hairline: little curls along the forehead.
        const [rx, ry] = pt(0, hc - 0.7, R + 0.9, HEAD_RY + 0.7, Math.PI * 2 + low);
        ctx.lineTo(rx - 1.1, ry);
        if (female) ctx.quadraticCurveTo(R - 0.4, hc - 0.6, R - 1.2, hc - 1.6);
        const xs = [R - 1.2, 1.4, -0.2, -1.8, -R + 1.2];
        for (let i = 1; i < xs.length; i++) ctx.quadraticCurveTo((xs[i - 1] + xs[i]) / 2, hc - 0.9, xs[i], hc - 1.7);
        const [lx, ly] = pt(0, hc - 0.7, R + 0.9, HEAD_RY + 0.7, Math.PI - low);
        if (female) ctx.quadraticCurveTo(-R + 0.4, hc - 0.6, lx + 1.1, ly);
        else ctx.lineTo(lx + 1.1, ly);
      }, H);
      curls(ctx, p, [[-2.4, hc - 3.2], [0.2, hc - 3.9], [2.5, hc - 3.0], [-0.9, hc - 2.4], [1.4, hc - 2.3]]);
      if (female) curls(ctx, p, [[-R - 0.2, hc + 1.5], [R + 0.2, hc + 1.5], [-R + 0.2, hc + 3.6], [R - 0.2, hc + 3.6]]);
      break;
    }
    case 'bald':
      ell(ctx, -1.4, hc - 3.0, 1.4, 0.8, shade(look.skin, 0.25), false);
      if (look.hairColor !== look.skin) {
        ctx.save();
        clipHead(ctx, 0, hc);
        ell(ctx, -R + 0.1, hc - 0.1, 0.55, 1.4, mix(H, look.skin, 0.45), false);
        ell(ctx, R - 0.1, hc - 0.1, 0.55, 1.4, mix(H, look.skin, 0.45), false);
        ctx.restore();
      }
      break;
  }
}

function hairBack(ctx: Ctx, look: CharacterLook, p: Pal, hc: number) {
  const H = p.hair;
  const female = look.body === 'female';
  if (look.hairStyle === 'bald') {
    ell(ctx, -1.2, hc - 2.6, 1.6, 0.9, shade(look.skin, 0.22), false);
    if (look.hairColor !== look.skin) {
      ctx.save();
      clipHead(ctx, 0, hc);
      ell(ctx, 0, hc + 2.4, HEAD_RX, 1.5, mix(H, look.skin, 0.45), false);
      ctx.restore();
    }
    return;
  }
  if (look.hairStyle === 'long') {
    shape(ctx, () => {
      ctx.moveTo(0, hc - HEAD_RY - 0.7);
      ctx.bezierCurveTo(-HEAD_RX - 1.0, hc - HEAD_RY - 0.6, -HEAD_RX - 1.5, hc - 2.0, -HEAD_RX - 1.3, hc + 1.0);
      ctx.quadraticCurveTo(-HEAD_RX - 1.4, hc + 6.0, -HEAD_RX - 0.4, hc + 8.6);
      ctx.quadraticCurveTo(0, hc + 9.3, HEAD_RX + 0.4, hc + 8.6);
      ctx.quadraticCurveTo(HEAD_RX + 1.4, hc + 6.0, HEAD_RX + 1.3, hc + 1.0);
      ctx.bezierCurveTo(HEAD_RX + 1.5, hc - 2.0, HEAD_RX + 1.0, hc - HEAD_RY - 0.6, 0, hc - HEAD_RY - 0.7);
    }, H);
    for (const x of [-2.2, 0, 2.2]) line(ctx, x * 0.6, hc - 1, x, hc + 7.6, 0.25, p.hairShade);
    line(ctx, -1.8, hc - 2.8, 0.6, hc - 3.6, 0.6, p.hairLight);
    return;
  }
  if (look.hairStyle === 'curly') {
    shape(ctx, () => scallop(ctx, 0, hc + (female ? 1.2 : -0.2), HEAD_RX + 0.8, HEAD_RY + (female ? 2.2 : 0.6), 0, Math.PI * 2, female ? 14 : 12, 0.45, true), H);
    curls(ctx, p, [[-2, hc - 2.4], [1.4, hc - 3.2], [0, hc - 0.6], [-2.4, hc + 1.2], [2.2, hc + 0.8]]);
    return;
  }
  const c = look.hairStyle === 'buzz' ? mix(H, look.skin, 0.3) : H;
  ell(ctx, 0, hc - 0.2, HEAD_RX + 0.45, HEAD_RY + 0.3, c);
  line(ctx, -1.8, hc - 2.8, 0.6, hc - 3.6, 0.6, p.hairLight);
  if (look.hairStyle === 'bun') ell(ctx, 0, hc - 1.4, 2.1, 1.9, H);
  if (look.hairStyle === 'ponytail') {
    capsule(ctx, 0, hc + 1.2, 0.2, hc + 6.8, 2.2, H);
    rrect(ctx, -1.0, hc + 0.6, 2, 0.9, 0.3, '#2a2a33', false);
  }
}

function hairSide(ctx: Ctx, look: CharacterLook, p: Pal, hc: number) {
  const H = p.hair;
  const female = look.body === 'female';
  if (look.hairStyle === 'bald') {
    ell(ctx, -0.6, hc - 3.0, 1.6, 0.8, shade(look.skin, 0.25), false);
    if (look.hairColor !== look.skin) {
      ctx.save();
      clipHead(ctx, 0.4, hc);
      ell(ctx, -3.3, hc + 0.9, 0.9, 1.4, mix(H, look.skin, 0.55), false);
      ctx.restore();
    }
    return;
  }
  if (look.hairStyle === 'curly') {
    shape(ctx, () => {
      scallop(ctx, 0.2, hc - 0.5, HEAD_RX + 0.8, HEAD_RY + 0.6, Math.PI * (female ? 0.5 : 0.62), Math.PI * 2 - 0.4, female ? 11 : 9, 0.45, true);
      ctx.lineTo(2.2, hc - 1.7);
      ctx.quadraticCurveTo(1.0, hc - 1.4, 0.6, hc - 0.4);
      ctx.lineTo(-0.9, hc + 2.0);
    }, H);
    curls(ctx, p, [[-1.8, hc - 2.4], [0.6, hc - 3.4], [-2.6, hc + 0.6]]);
    return;
  }
  const c = look.hairStyle === 'buzz' ? mix(H, look.skin, 0.3) : H;
  const fringe = look.hairStyle === 'short' || look.hairStyle === 'long';
  shape(ctx, () => {
    const [sx, sy] = pt(0.3, hc - 0.35, HEAD_RX + 0.5, HEAD_RY + 0.4, Math.PI * 0.62);
    ctx.moveTo(sx, sy);
    ctx.ellipse(0.3, hc - 0.35, HEAD_RX + 0.5, HEAD_RY + 0.4, 0, Math.PI * 0.62, Math.PI * 1.97);
    if (look.hairStyle === 'buzz') {
      ctx.quadraticCurveTo(2.6, hc - 2.0, 1.2, hc - 1.6);
    } else if (fringe) {
      ctx.lineTo(HEAD_RX + 0.3, hc - 1.9);
      ctx.quadraticCurveTo(2.8, hc - 1.4, 1.6, hc - 1.9);
    } else {
      ctx.quadraticCurveTo(3.0, hc - 2.6, 1.4, hc - 2.0);
    }
    // Hairline down past the ear to the nape.
    ctx.quadraticCurveTo(0.6, hc - 1.0, 0.6, hc + 0.4);
    ctx.quadraticCurveTo(-0.6, hc + 1.6, -1.6, hc + 3.0);
  }, c);
  if (look.hairStyle !== 'buzz') line(ctx, -1.6, hc - 3.6, 1.0, hc - 4.4, 0.55, p.hairLight);
  if (look.hairStyle === 'bun') ell(ctx, -2.8, hc - HEAD_RY + 0.6, 2.0, 1.8, H);
  if (look.hairStyle === 'ponytail') {
    capsule(ctx, -HEAD_RX + 0.2, hc - 0.6, -HEAD_RX - 1.4, hc + 5.6, 2.1, H);
    rrect(ctx, -HEAD_RX - 0.6, hc - 0.9, 1.4, 1.0, 0.3, '#2a2a33', false);
  }
  if (look.hairStyle === 'long') line(ctx, -1.0, hc - 0.5, -2.6, hc + 6.0, 0.25, p.hairShade);
}

/** Beard color: the hair color, a touch warmer. */
const beardColor = (look: CharacterLook, p: Pal) => mix(p.hair, shade(look.skin, -0.35), 0.18);

function beardFrontShape(ctx: Ctx, look: CharacterLook, p: Pal, hc: number) {
  const B = beardColor(look, p);
  const R = HEAD_RX;
  shape(ctx, () => {
    // Along the jaw from sideburn to sideburn.
    const a0 = -0.12;
    const [x0, y0] = pt(0, hc, R + 0.15, HEAD_RY + 0.35, a0);
    ctx.moveTo(x0, y0);
    ctx.ellipse(0, hc, R + 0.15, HEAD_RY + 0.35, 0, a0, Math.PI - a0);
    // Up the left cheek, the moustache over the mouth, down the right cheek.
    ctx.quadraticCurveTo(-R + 0.6, hc + 1.4, -2.0, hc + 1.9);
    ctx.quadraticCurveTo(-1.4, hc + 1.75, -0.5, hc + 2.1);
    ctx.quadraticCurveTo(0, hc + 1.95, 0.5, hc + 2.1);
    ctx.quadraticCurveTo(1.4, hc + 1.75, 2.0, hc + 1.9);
    ctx.quadraticCurveTo(R - 0.6, hc + 1.4, x0, y0);
  }, B, false);
  // The lips show through the beard.
  ell(ctx, 0, hc + 3.0, 1.0, 0.45, mix(p.lip, B, 0.3), false);
  ctx.globalAlpha = 0.5;
  for (const [x, y] of [[-2.6, hc + 3.0], [2.5, hc + 3.2], [-1.2, hc + 4.4], [1.0, hc + 4.5], [0, hc + 3.9]] as const)
    line(ctx, x, y, x + 0.25, y + 0.6, 0.22, shade(B, 0.25));
  ctx.globalAlpha = 1;
}

function beardSideShape(ctx: Ctx, look: CharacterLook, p: Pal, hc: number) {
  const B = beardColor(look, p);
  shape(ctx, () => {
    ctx.moveTo(-0.2, hc - 0.3);
    ctx.quadraticCurveTo(-0.3, hc + 4.0, 2.0, hc + HEAD_RY + 0.35);
    ctx.quadraticCurveTo(HEAD_RX + 0.2, hc + 4.6, HEAD_RX + 0.25, hc + 3.6);
    ctx.lineTo(HEAD_RX + 0.4, hc + 2.2);
    ctx.quadraticCurveTo(3.4, hc + 1.9, 2.4, hc + 2.0);
    ctx.quadraticCurveTo(1.2, hc + 1.6, 0.9, hc + 0.4);
  }, B, false);
  line(ctx, 3.0, hc + 2.85, 3.9, hc + 2.75, 0.45, mix(p.lip, B, 0.3));
}

/* ------------------------------------------------------------------ */
/* Face                                                                */
/* ------------------------------------------------------------------ */

function faceFront(ctx: Ctx, look: CharacterLook, p: Pal, hc: number, pose: PersonPose) {
  const ex = pose.expression ?? 'neutral';
  const female = look.body === 'female';
  const detail = !!pose.detail;
  const eyeY = hc + 0.5;
  const down = ex === 'broken' ? 0.25 : 0;
  for (const s of [-1, 1]) {
    const x = s * 1.6;
    if (pose.blink) {
      line(ctx, x - 0.7, eyeY, x + 0.7, eyeY, 0.35, '#1c1a22');
    } else if (detail) {
      ell(ctx, x, eyeY, 0.85, ex === 'tense' ? 0.65 : 0.55, '#f2eee8', false);
      ell(ctx, x + s * -0.05, eyeY + down, 0.48, 0.5, '#2a1d17', false);
      ell(ctx, x + 0.15, eyeY - 0.12 + down, 0.13, 0.13, '#ffffff', false);
      line(ctx, x - 0.85, eyeY - 0.5, x + 0.85, eyeY - 0.5, female ? 0.35 : 0.22, '#1c1a22');
    } else {
      ell(ctx, x, eyeY + down * 0.5, 0.5, 0.58, '#1c1a22', false);
    }
    // Brows follow the mood.
    const inner = ex === 'defiant' ? 0.35 : ex === 'tense' || ex === 'broken' ? -0.45 : 0;
    const outer = ex === 'defiant' ? -0.3 : ex === 'tense' || ex === 'broken' ? 0.25 : 0;
    const bc = look.hairStyle === 'bald' ? shade(look.skin, -0.4) : p.hairShade;
    line(ctx, s * 0.75, hc - 0.85 + inner, s * 2.45, hc - 0.95 + outer, female ? 0.35 : 0.5, bc);
  }
  // Nose.
  if (detail) {
    line(ctx, 0.15, hc + 0.9, 0.45, hc + 1.9, 0.3, p.skinShade);
    line(ctx, -0.35, hc + 2.05, 0.55, hc + 2.05, 0.3, p.skinShade);
  } else ell(ctx, 0.2, hc + 1.7, 0.35, 0.25, p.skinShade, false);
  // Mouth.
  const my = hc + 2.85;
  ctx.lineCap = 'round';
  if (pose.mouthOpen) {
    ell(ctx, 0, my + 0.1, 0.95, 0.6, '#3b1c21', false);
    if (detail) rrect(ctx, -0.6, my - 0.4, 1.2, 0.3, 0.1, '#eee7de', false);
  } else {
    ctx.strokeStyle = p.lip;
    ctx.lineWidth = female ? 0.55 : 0.4;
    ctx.beginPath();
    if (ex === 'smile') {
      ctx.moveTo(-1.1, my - 0.2);
      ctx.quadraticCurveTo(0, my + 0.8, 1.1, my - 0.2);
    } else if (ex === 'tense' || ex === 'broken') {
      ctx.moveTo(-1.0, my + 0.35);
      ctx.quadraticCurveTo(0, my - 0.45, 1.0, my + 0.35);
    } else if (ex === 'defiant') {
      ctx.moveTo(-0.9, my + 0.15);
      ctx.quadraticCurveTo(0.2, my + 0.2, 1.1, my - 0.4);
    } else {
      ctx.moveTo(-0.9, my);
      ctx.quadraticCurveTo(0, my + 0.25, 0.9, my);
    }
    ctx.stroke();
  }
  if (female) {
    ell(ctx, -2.4, hc + 1.7, 0.8, 0.45, 'rgba(224,120,120,0.22)', false);
    ell(ctx, 2.4, hc + 1.7, 0.8, 0.45, 'rgba(224,120,120,0.22)', false);
  }
  if (detail && ex === 'tense') ell(ctx, HEAD_RX - 0.6, hc - 2.0, 0.35, 0.6, 'rgba(170,215,255,0.9)', false);
  if (detail && ex === 'broken') ell(ctx, -1.7, hc + 1.6, 0.25, 0.55, 'rgba(160,205,255,0.9)', false);
}

function glassesFront(ctx: Ctx, hc: number) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 1.65, hc + 0.5, 1.2, 1.0, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(205,225,245,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#1f222a';
    ctx.lineWidth = 0.42;
    ctx.stroke();
    line(ctx, s * 2.85, hc + 0.3, s * (HEAD_RX - 0.1), hc + 0.1, 0.35, '#1f222a');
  }
  line(ctx, -0.45, hc + 0.3, 0.45, hc + 0.3, 0.35, '#1f222a');
}

function capFront(ctx: Ctx, hc: number, back: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-8, hc - 9, 16, 7.2);
  ctx.clip();
  ell(ctx, 0, hc - 1.6, HEAD_RX + 0.7, HEAD_RY - 0.4, NAVY);
  ctx.restore();
  rrect(ctx, -HEAD_RX - 0.6, hc - 2.9, HEAD_RX * 2 + 1.2, 1.3, 0.4, '#121a30');
  if (!back) {
    ell(ctx, 0, hc - 1.5, HEAD_RX + 0.3, 0.8, '#0b0e18');
    ell(ctx, 0, hc - 4.0, 0.8, 0.7, GOLD, false);
  }
}

/* ------------------------------------------------------------------ */
/* Clothes                                                             */
/* ------------------------------------------------------------------ */

function torsoFront(ctx: Ctx, look: CharacterLook, p: Pal, sw: number, sy: number, hy: number, back: boolean) {
  const o = look.outfit;
  const coat = o === 'labcoat';
  const body = coat ? '#eef0f2' : p.top;
  const long = coat ? 5.2 : o === 'blazer' || o === 'suit' || o === 'leather' ? 1.6 : 0.6;
  rrect(ctx, -sw, sy, sw * 2, hy - sy + long, 2.4, body);
  // Soft side shading.
  ctx.save();
  rrectPath(ctx, -sw, sy, sw * 2, hy - sy + long, 2.4);
  ctx.clip();
  ctx.fillStyle = 'rgba(10,14,30,0.18)';
  ctx.fillRect(sw - 1.8, sy, 2, hy - sy + long);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-sw, sy, 1.4, hy - sy + long);
  ctx.restore();

  if (back) {
    if (o === 'hoodie') rrect(ctx, -3.2, sy - 0.4, 6.4, 3.4, 1.6, p.topShade);
    if (o === 'uniform') {
      rrect(ctx, -sw + 0.2, sy - 0.2, 2.4, 1.3, 0.4, NAVY);
      rrect(ctx, sw - 2.6, sy - 0.2, 2.4, 1.3, 0.4, NAVY);
      rrect(ctx, -sw, hy - 1.4, sw * 2, 1.2, 0.3, '#16171b', false);
    }
    if (o === 'blazer' || o === 'suit' || o === 'leather') line(ctx, -1.8, sy + 0.4, 1.8, sy + 0.4, 0.6, o === 'leather' ? p.topLight : SHIRT);
    if (o === 'apron') line(ctx, -sw, hy - 3, sw, hy - 3, 0.6, '#e6dfcf');
    return;
  }

  switch (o) {
    case 'blazer':
    case 'suit':
      poly(ctx, [-1.7, sy, 1.7, sy, 0, sy + 4.6], SHIRT);
      if (o === 'suit') poly(ctx, [-0.5, sy + 0.5, 0.5, sy + 0.5, 0.75, sy + 5.0, 0, sy + 5.9, -0.75, sy + 5.0], '#7a1f2c');
      line(ctx, -1.8, sy + 0.1, -0.2, sy + 5.0, 0.7, p.topShade);
      line(ctx, 1.8, sy + 0.1, 0.2, sy + 5.0, 0.7, p.topShade);
      line(ctx, 0, sy + 5.0, 0, hy + long, 0.3, p.topShade);
      ell(ctx, 0.5, sy + 6.6, 0.28, 0.28, p.topLight, false);
      ell(ctx, 0.5, sy + 8.2, 0.28, 0.28, p.topLight, false);
      break;
    case 'leather':
      rrect(ctx, -1.5, sy + 0.2, 3, hy - sy + 0.6, 0.5, '#b9b3a7', false);
      poly(ctx, [-1.6, sy, -3.6, sy + 0.3, -1.8, sy + 2.6], p.topLight);
      poly(ctx, [1.6, sy, 3.6, sy + 0.3, 1.8, sy + 2.6], p.topLight);
      line(ctx, -1.5, sy + 2.4, -1.5, hy + long, 0.3, '#9ca0a8');
      line(ctx, 1.5, sy + 2.4, 1.5, hy + long, 0.3, '#9ca0a8');
      break;
    case 'hoodie':
      line(ctx, -0.8, sy + 0.6, -0.9, sy + 4.0, 0.3, '#e3e0d8');
      line(ctx, 0.8, sy + 0.6, 0.9, sy + 4.0, 0.3, '#e3e0d8');
      rrect(ctx, -3.0, sy + 5.4, 6.0, 2.6, 1.0, p.topShade);
      break;
    case 'uniform':
      poly(ctx, [-1.1, sy, 1.1, sy, 0, sy + 1.8], look.skin);
      poly(ctx, [-1.1, sy, -2.6, sy + 0.2, -1.2, sy + 2.0], p.topLight);
      poly(ctx, [1.1, sy, 2.6, sy + 0.2, 1.2, sy + 2.0], p.topLight);
      rrect(ctx, -sw + 0.2, sy - 0.2, 2.4, 1.3, 0.4, NAVY);
      rrect(ctx, sw - 2.6, sy - 0.2, 2.4, 1.3, 0.4, NAVY);
      line(ctx, -sw + 0.9, sy + 0.45, -sw + 1.9, sy + 0.45, 0.25, GOLD);
      line(ctx, sw - 1.9, sy + 0.45, sw - 0.9, sy + 0.45, 0.25, GOLD);
      poly(ctx, [1.8, sy + 2.2, 3.0, sy + 2.2, 3.0, sy + 3.4, 2.4, sy + 4.0, 1.8, sy + 3.4], GOLD, true);
      rrect(ctx, -3.2, sy + 2.5, 1.9, 0.7, 0.2, '#f4f4f4', false);
      line(ctx, -3.4, sy + 3.9, -1.3, sy + 3.9, 0.3, p.topShade);
      line(ctx, 0, sy + 1.8, 0, hy - 1.4, 0.25, p.topShade);
      rrect(ctx, -sw, hy - 1.4, sw * 2, 1.2, 0.3, '#16171b', false);
      rrect(ctx, -0.7, hy - 1.4, 1.4, 1.2, 0.2, GOLD, false);
      break;
    case 'tshirt':
    case 'apron':
      ell(ctx, 0, sy + 0.1, 1.7, 0.95, look.skin);
      if (o === 'apron') {
        rrect(ctx, -3.1, sy + 3.0, 6.2, hy - sy, 1.0, '#e9e2d2');
        line(ctx, -2.6, sy + 3.1, -1.4, sy, 0.4, '#e9e2d2');
        line(ctx, 2.6, sy + 3.1, 1.4, sy, 0.4, '#e9e2d2');
        rrect(ctx, -1.8, sy + 6.0, 3.6, 1.6, 0.4, shade('#e9e2d2', -0.1), false);
      }
      break;
    case 'vest':
      poly(ctx, [-1.8, sy, 1.8, sy, 0, sy + 5.2], '#d3d6d9');
      line(ctx, -1.8, sy, 0, sy + 5.2, 0.4, p.topShade);
      line(ctx, 1.8, sy, 0, sy + 5.2, 0.4, p.topShade);
      ell(ctx, 2.6, sy + 3, 0.6, 0.6, GOLD, false);
      break;
    case 'labcoat':
      poly(ctx, [-1.6, sy, 1.6, sy, 0, sy + 3.4], p.top);
      line(ctx, -1.6, sy, -0.1, sy + 4.0, 0.55, '#c6ccd3');
      line(ctx, 1.6, sy, 0.1, sy + 4.0, 0.55, '#c6ccd3');
      line(ctx, 0, sy + 4.0, 0, hy + long, 0.3, '#b9c0c8');
      rrect(ctx, 1.6, sy + 2.2, 2.0, 1.8, 0.3, '#e2e5e8');
      line(ctx, 2.1, sy + 1.6, 2.1, sy + 2.6, 0.35, '#2563eb');
      rrect(ctx, -3.6, hy - 0.6, 2.2, 1.8, 0.3, '#e2e5e8');
      break;
  }
}

/* ------------------------------------------------------------------ */
/* The person                                                          */
/* ------------------------------------------------------------------ */

/** Draw a character standing at (x, y) = feet position, in world units. */
export function drawPerson(ctx: Ctx, look: CharacterLook, x: number, y: number, pose: PersonPose, scale = 0.86) {
  const p = pal(look);
  const female = look.body === 'female';
  const phase = pose.phase ?? 0;
  const moving = !!pose.moving;
  const s = moving ? Math.sin(phase) : 0;
  const bob = moving ? -Math.abs(Math.cos(phase)) * 0.55 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';

  // Ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, -0.2, 5.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose.dir === DIR_LEFT) ctx.scale(-1, 1);
  if (pose.dir === DIR_LEFT || pose.dir === DIR_RIGHT) drawSide(ctx, look, p, s, bob, pose);
  else drawFrontBack(ctx, look, p, s, bob, pose, pose.dir === DIR_UP, female);
  ctx.restore();
}

function drawFrontBack(ctx: Ctx, look: CharacterLook, p: Pal, s: number, bob: number, pose: PersonPose, back: boolean, female: boolean) {
  const sw = female ? 4.5 : 5.1;
  const sy = SHOULDER + bob;
  const hy = HIP + bob;
  const hc = HEAD_Y + bob;
  const sleeve = sleeveColor(look, p);
  const shortSl = !longSleeves(look.outfit);

  // Long hair falls behind the shoulders.
  if (!back) hairBehind(ctx, look, p, hc, false);

  // Legs: the lifted foot rises a little.
  const legX = female ? 1.8 : 2.15;
  const legW = female ? 2.7 : 3.1;
  for (const side of [-1, 1]) {
    const lift = Math.max(0, side * s) * 1.4;
    const fx = side * legX;
    capsule(ctx, fx, hy, fx, -1.4 - lift, legW, side > 0 ? p.pants : shade(p.pants, -0.06));
    ell(ctx, fx, -0.9 - lift, legW * 0.62, 1.15, SHOE);
  }

  // Arms swing opposite to the legs.
  for (const side of [-1, 1]) {
    const sx = side * (sw - 0.6);
    const swing = -side * s * 0.9;
    const ex = side * (sw + 0.4);
    const ey = sy + 5.0 + swing * 0.4;
    const hx = side * (sw + 0.2);
    const hyy = hy + 0.6 + swing;
    capsule(ctx, sx, sy + 1.4, ex, ey, 2.7, sleeve);
    capsule(ctx, ex, ey, hx, hyy, 2.5, shortSl ? look.skin : sleeve);
    ell(ctx, hx, hyy + 0.6, 1.15, 1.15, look.skin);
  }

  torsoFront(ctx, look, p, sw, sy, hy, back);

  // Neck and head.
  rrect(ctx, -1.25, sy - 2.2, 2.5, 2.8, 0.6, p.skinShade, false);
  if (back) {
    ell(ctx, -HEAD_RX + 0.1, hc + 0.6, 0.8, 1.1, p.skinShade);
    ell(ctx, HEAD_RX - 0.1, hc + 0.6, 0.8, 1.1, p.skinShade);
    ell(ctx, 0, hc, HEAD_RX, HEAD_RY, look.skin);
    hairBack(ctx, look, p, hc);
    if (look.cap) capFront(ctx, hc, true);
    return;
  }
  ell(ctx, -HEAD_RX + 0.05, hc + 0.6, 0.85, 1.15, look.skin);
  ell(ctx, HEAD_RX - 0.05, hc + 0.6, 0.85, 1.15, look.skin);
  ell(ctx, 0, hc, HEAD_RX, HEAD_RY, look.skin);
  // Jaw shading.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, hc, HEAD_RX, HEAD_RY, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(40,20,20,0.10)';
  ctx.fillRect(HEAD_RX - 1.3, hc - HEAD_RY, 2, HEAD_RY * 2);
  ctx.restore();
  if (look.beard) beardFrontShape(ctx, look, p, hc);
  faceFront(ctx, look, p, hc, pose);
  hairFront(ctx, look, p, hc);
  if (look.glasses) glassesFront(ctx, hc);
  if (look.cap) capFront(ctx, hc, false);
}

function drawSide(ctx: Ctx, look: CharacterLook, p: Pal, s: number, bob: number, pose: PersonPose) {
  const female = look.body === 'female';
  const sy = SHOULDER + bob;
  const hy = HIP + bob;
  const hc = HEAD_Y + bob;
  const sleeve = sleeveColor(look, p);
  const shortSl = !longSleeves(look.outfit);
  const o = look.outfit;
  const a = s * 0.5;
  const legLen = -hy - 1.3;

  hairBehind(ctx, look, p, hc, true);

  // Far arm (behind the body).
  const armA = -a * 0.9;
  capsule(ctx, -0.2, sy + 1.5, -0.2 + Math.sin(-armA) * 4.8, sy + 1.5 + Math.cos(armA) * 4.8, 2.5, shade(sleeve, -0.18));
  // Legs.
  for (const [ang, far] of [[-a, true], [a, false]] as const) {
    const fx = 0.3 + Math.sin(ang) * legLen;
    const fy = hy + Math.cos(ang) * legLen;
    const kx = 0.3 + Math.sin(ang) * legLen * 0.5 + (ang < 0 ? 0.4 : 0);
    const ky = hy + Math.cos(ang) * legLen * 0.5;
    const c = far ? p.pantsShade : p.pants;
    capsule(ctx, 0.3, hy, kx, ky, 3.4, c);
    capsule(ctx, kx, ky, fx, fy - 0.4, 3.1, c);
    ell(ctx, fx + 0.9, fy - 0.2, 2.2, 1.1, far ? '#141317' : SHOE);
  }

  // Torso.
  const coat = o === 'labcoat';
  const long = coat ? 5.2 : o === 'blazer' || o === 'suit' || o === 'leather' ? 1.6 : 0.6;
  rrect(ctx, -3.4, sy, 7.0, hy - sy + long, 2.4, coat ? '#eef0f2' : p.top);
  ctx.save();
  rrectPath(ctx, -3.4, sy, 7.0, hy - sy + long, 2.4);
  ctx.clip();
  ctx.fillStyle = 'rgba(10,14,30,0.16)';
  ctx.fillRect(-3.4, sy, 1.6, hy - sy + long);
  ctx.restore();
  if (female) ell(ctx, 2.4, sy + 3.0, 0.9, 1.2, shade(coat ? '#eef0f2' : p.top, 0.06), false);
  if (o === 'blazer' || o === 'suit') {
    line(ctx, 2.6, sy + 0.4, 1.4, sy + 4.4, 0.6, SHIRT);
    if (o === 'suit') line(ctx, 2.7, sy + 1.0, 2.7, sy + 5.0, 0.5, '#7a1f2c');
  } else if (o === 'uniform') {
    rrect(ctx, -1.2, sy - 0.2, 2.6, 1.2, 0.4, NAVY);
    ell(ctx, 2.0, sy + 2.6, 0.55, 0.65, GOLD, false);
    rrect(ctx, -2.9, hy - 1.4, 6.0, 1.2, 0.3, '#16171b', false);
  } else if (o === 'hoodie') {
    rrect(ctx, -3.6, sy - 0.6, 3.4, 3.6, 1.4, p.topShade);
  } else if (o === 'apron') {
    rrect(ctx, 1.9, sy + 3.0, 1.4, hy - sy, 0.5, '#e9e2d2', false);
  } else if (o === 'leather') {
    poly(ctx, [1.2, sy, 3.3, sy + 0.4, 1.6, sy + 2.4], p.topLight);
  } else if (o === 'vest') {
    line(ctx, 2.7, sy + 0.4, 2.0, sy + 4.4, 0.6, '#d3d6d9');
  }

  // Near arm.
  const ex = 0.3 + Math.sin(armA) * 4.4;
  const ey = sy + 1.6 + Math.cos(armA) * 4.4;
  const hx = ex + Math.sin(armA * 1.4) * 4.2;
  const hyy = ey + Math.cos(armA * 1.4) * 4.2;
  capsule(ctx, 0.3, sy + 1.6, ex, ey, 2.7, sleeve);
  capsule(ctx, ex, ey, hx, hyy, 2.5, shortSl ? look.skin : sleeve);
  ell(ctx, hx, hyy + 0.5, 1.15, 1.15, look.skin);

  // Neck and head.
  rrect(ctx, -0.8, sy - 2.2, 2.4, 2.8, 0.6, p.skinShade, false);
  ell(ctx, 0.4, hc, HEAD_RX - 0.2, HEAD_RY, look.skin);
  // Nose.
  poly(ctx, [HEAD_RX - 0.1, hc + 0.2, HEAD_RX + 1.0, hc + 1.6, HEAD_RX - 0.2, hc + 1.9], look.skin);
  line(ctx, HEAD_RX - 0.1, hc + 0.2, HEAD_RX + 1.0, hc + 1.6, LW, OL);
  line(ctx, HEAD_RX + 1.0, hc + 1.6, HEAD_RX - 0.2, hc + 1.9, LW, OL);
  // Eye, brow, mouth.
  if (pose.blink) line(ctx, 2.0, hc + 0.4, 3.0, hc + 0.4, 0.35, '#1c1a22');
  else ell(ctx, 2.5, hc + 0.4, 0.42, 0.55, '#1c1a22', false);
  line(ctx, 1.8, hc - 0.8, 3.2, hc - 0.9, female ? 0.35 : 0.5, look.hairStyle === 'bald' ? shade(look.skin, -0.4) : p.hairShade);
  line(ctx, 2.9, hc + 2.85, 3.8, hc + 2.75, female ? 0.5 : 0.4, p.lip);
  if (look.beard) beardSideShape(ctx, look, p, hc);
  hairSide(ctx, look, p, hc);
  // The ear sits in front of the hair line.
  if (look.hairStyle !== 'long' && !(look.hairStyle === 'curly' && female)) {
    ctx.beginPath();
    ctx.ellipse(-0.2, hc + 0.8, 0.8, 1.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = look.skin;
    ctx.fill();
    ctx.strokeStyle = p.skinShade;
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-0.15, hc + 0.85, 0.42, Math.PI * 0.6, Math.PI * 1.6);
    ctx.stroke();
  }
  if (look.glasses) {
    ctx.beginPath();
    ctx.ellipse(2.8, hc + 0.4, 1.05, 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(205,225,245,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#1f222a';
    ctx.lineWidth = 0.42;
    ctx.stroke();
    line(ctx, 1.75, hc + 0.3, -0.3, hc + 0.2, 0.35, '#1f222a');
  }
  if (look.cap) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-8, hc - 9, 16, 7.2);
    ctx.clip();
    ell(ctx, 0.2, hc - 1.6, HEAD_RX + 0.6, HEAD_RY - 0.4, NAVY);
    ctx.restore();
    rrect(ctx, -HEAD_RX - 0.2, hc - 2.9, HEAD_RX * 2 + 0.6, 1.3, 0.4, '#121a30');
    ell(ctx, HEAD_RX + 1.0, hc - 1.6, 2.0, 0.6, '#0b0e18');
    ell(ctx, 2.0, hc - 3.9, 0.6, 0.6, GOLD, false);
  }
}

/**
 * Head-and-shoulders close-up for conversations: the same character, framed
 * from the top of the hair to the chest, filling a size x size square.
 */
export function drawPortrait(
  ctx: Ctx,
  look: CharacterLook,
  size: number,
  opts: { expression?: Expression; mouthOpen?: boolean; blink?: boolean; back?: boolean } = {},
) {
  const top = -31.6;
  const bottom = -13.6;
  const k = size / (bottom - top);
  ctx.save();
  ctx.translate(size / 2, -top * k);
  drawPerson(
    ctx,
    look,
    0,
    0,
    { dir: opts.back ? DIR_UP : DIR_DOWN, expression: opts.expression, mouthOpen: opts.mouthOpen, blink: opts.blink, detail: true },
    k,
  );
  ctx.restore();
}

/** Walk phase advance per tile walked: one full stride every ~1.6 tiles. */
export const STRIDE_PER_TILE = Math.PI * 1.25;
