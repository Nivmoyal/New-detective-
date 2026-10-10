// Smooth, vector-painted city: ground tiles, facades, roofs and the most
// common street objects, drawn with paths and gradients at a high internal
// resolution so the world matches the characters instead of a pixel grid.
// Coordinates are world pixels (16 per tile); callers scale the context.
import { hashString, seeded, shade } from '../color';
import { FACADE_UPPER, FloorStyle, T, Tile, WallStyle, type Building, type PixelMap, type Prop } from './types';
import { WALL_COLORS, styleAt, tileAt } from './tiles';

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number) {
  const r = Math.max(0, Math.min(rad, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number, fill: string | CanvasGradient) {
  rr(ctx, x, y, w, h, rad);
  ctx.fillStyle = fill;
  ctx.fill();
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function vgrad(ctx: Ctx, y0: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function hgrad(ctx: Ctx, x0: number, x1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Soft contact shadow under an object. */
function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.38) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(0,0,0,${a})`);
  g.addColorStop(0.6, `rgba(0,0,0,${a * 0.6})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function line(ctx: Ctx, pts: number[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fine grain, much smaller than a world pixel. */
let grainCanvas: HTMLCanvasElement | null = null;
function grain(ctx: Ctx, x: number, y: number, w: number, h: number, alpha: number) {
  if (!grainCanvas) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = 96;
    grainCanvas.height = 96;
    const g = grainCanvas.getContext('2d')!;
    const img = g.createImageData(96, 96);
    const rnd = seeded(1234);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd();
      const light = v > 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
      img.data[i + 3] = Math.floor(Math.abs(v - 0.5) * 2 * 90 * (rnd() < 0.6 ? 0.4 : 1));
    }
    g.putImageData(img, 0, 0);
  }
  const pat = ctx.createPattern(grainCanvas, 'repeat');
  if (!pat) return;
  const m = ctx.getTransform();
  // Keep the grain at device resolution whatever the context scale.
  pat.setTransform(new DOMMatrix([1 / m.a, 0, 0, 1 / m.d, 0, 0]));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

const isWallish = (t: number) => t === Tile.Wall || t === Tile.Void || t === Tile.Solid;
const isRoad = (t: number) => t === Tile.Asphalt || t === Tile.Marking || t === Tile.Crosswalk;

/* ------------------------------------------------------------------ */
/* Floors                                                              */
/* ------------------------------------------------------------------ */

const FLOORS: Record<number, [string, string, string]> = {
  [FloorStyle.Tile]: ['#424a57', '#353c47', '#4c5665'],
  [FloorStyle.Lab]: ['#c5ccd2', '#a9b1ba', '#d8dde2'],
  [FloorStyle.Wood]: ['#6d4c31', '#563b25', '#80603f'],
  [FloorStyle.Carpet]: ['#2f3a4d', '#273143', '#37445b'],
  [FloorStyle.Checker]: ['#9095a0', '#2a2d34', '#a3a8b2'],
  [FloorStyle.Concrete]: ['#4d4e51', '#424346', '#58595c'],
  [FloorStyle.Club]: ['#201c27', '#17141c', '#2b2532'],
  [FloorStyle.Lino]: ['#4b5661', '#3f4953', '#58646f'],
  [FloorStyle.Terrazzo]: ['#6f665a', '#5d554a', '#81786a'],
};

function floorHD(ctx: Ctx, px: number, py: number, style: number, rnd: () => number, tx: number, ty: number) {
  const [base, dark, light] = FLOORS[style] ?? FLOORS[FloorStyle.Tile];
  rect(ctx, px, py, T, T, dark);
  switch (style) {
    case FloorStyle.Tile:
    case FloorStyle.Lab: {
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const x = px + i * 8 + 0.3;
          const y = py + j * 8 + 0.3;
          const g = ctx.createLinearGradient(x, y, x + 7.4, y + 7.4);
          const v = (rnd() - 0.5) * 0.05;
          g.addColorStop(0, shade(light, v));
          g.addColorStop(0.5, shade(base, v));
          g.addColorStop(1, shade(base, v - 0.04));
          fillRR(ctx, x, y, 7.4, 7.4, 0.6, g);
        }
      grain(ctx, px, py, T, T, 0.25);
      break;
    }
    case FloorStyle.Wood: {
      for (let i = 0; i < 4; i++) {
        const y = py + i * 4;
        const v = (((tx * 7 + ty * 13 + i * 5) % 7) / 7 - 0.5) * 0.12;
        rect(ctx, px, y + 0.2, T, 3.6, vgrad(ctx, y, y + 4, [[0, shade(light, v)], [0.4, shade(base, v)], [1, shade(base, v - 0.1)]]));
        const off = ((ty * 4 + i) * 7 + tx * 16) % 16;
        rect(ctx, px + off, y + 0.2, 0.35, 3.6, shade(dark, -0.2));
        ctx.globalAlpha = 0.18;
        const gy = y + 1 + rnd() * 2;
        line(ctx, [px, gy, px + 5, gy + 0.3, px + 10, gy - 0.2, px + 16, gy + 0.2], shade(dark, -0.3), 0.25);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case FloorStyle.Carpet:
    case FloorStyle.Club:
      rect(ctx, px, py, T, T, base);
      grain(ctx, px, py, T, T, 0.28);
      break;
    case FloorStyle.Checker:
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const c = (i + j + tx + ty) % 2 === 0 ? base : dark;
          fillRR(ctx, px + i * 8 + 0.2, py + j * 8 + 0.2, 7.6, 7.6, 0.4, vgrad(ctx, py + j * 8, py + j * 8 + 8, [[0, shade(c, 0.08)], [1, c]]));
        }
      break;
    case FloorStyle.Concrete:
      rect(ctx, px, py, T, T, base);
      if (rnd() < 0.3) softShadow(ctx, px + 4 + rnd() * 8, py + 4 + rnd() * 8, 4 + rnd() * 3, 2.5, 0.12);
      grain(ctx, px, py, T, T, 0.45);
      rect(ctx, px, py, T, 0.3, dark);
      rect(ctx, px, py, 0.3, T, dark);
      break;
    case FloorStyle.Lino:
      rect(ctx, px, py, T, T, vgrad(ctx, py, py + T, [[0, light], [1, base]]));
      rect(ctx, px, py, T, 0.3, dark);
      grain(ctx, px, py, T, T, 0.3);
      break;
    case FloorStyle.Terrazzo: {
      rect(ctx, px, py, T, T, base);
      const chips = ['#7f7668', '#62594d', '#8a8172', '#6b6255', '#958b7b'];
      for (let i = 0; i < 10; i++) ellipse(ctx, px + rnd() * T, py + rnd() * T, 0.3 + rnd() * 0.5, 0.25 + rnd() * 0.4, chips[Math.floor(rnd() * chips.length)]);
      grain(ctx, px, py, T, T, 0.2);
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Walls                                                               */
/* ------------------------------------------------------------------ */

function material(ctx: Ctx, px: number, py: number, y0: number, h: number, style: number, face: string, rnd: () => number, tx: number) {
  const y = py + y0;
  if (style === WallStyle.Brick) {
    const mortar = shade(face, -0.28);
    rect(ctx, px, y, T, h, mortar);
    const rows = Math.ceil(h / 3);
    for (let row = 0; row < rows; row++) {
      const by = y + row * 3;
      const off = (row + tx) % 2 ? 0 : 4;
      for (let bx = -8 + off; bx < T; bx += 8) {
        const v = (((bx + row * 5 + tx * 3) * 37) % 11) / 11 - 0.5;
        const x0 = Math.max(px, px + bx + 0.25);
        const x1 = Math.min(px + T, px + bx + 7.75);
        if (x1 - x0 > 0.3) fillRR(ctx, x0, by + 0.25, x1 - x0, Math.min(2.5, y + h - by - 0.25), 0.35, vgrad(ctx, by, by + 3, [[0, shade(face, 0.08 + v * 0.12)], [1, shade(face, -0.06 + v * 0.12)]]));
      }
    }
    return;
  }
  if (style === WallStyle.Stone) {
    const mortar = shade(face, -0.22);
    rect(ctx, px, y, T, h, mortar);
    const rowsH = [4.5, 4, 4.5];
    let cy = y;
    for (let row = 0; cy < y + h; row++) {
      const hh = rowsH[row % 3];
      const off = (row + tx) % 2 ? 0 : 5;
      for (let bx = -10 + off; bx < T; bx += 10) {
        const v = (((bx + row * 7 + tx * 5) * 31) % 13) / 13 - 0.5;
        const x0 = Math.max(px, px + bx + 0.3);
        const x1 = Math.min(px + T, px + bx + 9.7);
        const bh = Math.min(hh - 0.5, y + h - cy - 0.3);
        if (x1 - x0 > 0.3 && bh > 0.3) fillRR(ctx, x0, cy + 0.3, x1 - x0, bh, 0.8, vgrad(ctx, cy, cy + hh, [[0, shade(face, 0.1 + v * 0.1)], [1, shade(face, -0.05 + v * 0.1)]]));
      }
      cy += hh;
    }
    return;
  }
  if (style === WallStyle.BlueTile) {
    rect(ctx, px, y, T, h, shade(face, -0.25));
    for (let j = 0; j * 4 < h; j++)
      for (let i = 0; i < 4; i++) {
        const v = (((i + j * 3 + tx * 5) * 17) % 7) / 7 - 0.5;
        fillRR(ctx, px + i * 4 + 0.25, y + j * 4 + 0.25, 3.5, Math.min(3.5, h - j * 4 - 0.25), 0.4, vgrad(ctx, y + j * 4, y + j * 4 + 4, [[0, shade(face, 0.2 + v * 0.1)], [1, shade(face, v * 0.1)]]));
      }
    return;
  }
  rect(ctx, px, y, T, h, vgrad(ctx, y, y + h, [[0, shade(face, 0.06)], [1, shade(face, -0.08)]]));
  grain(ctx, px, y, T, h, 0.35);
  if (style === WallStyle.Station) {
    const sy = y + h - 4.5;
    rect(ctx, px, sy, T, 3, vgrad(ctx, sy, sy + 3, [[0, '#7c90a8'], [0.3, '#5d6f86'], [1, '#4a5a6e']]));
  } else if (rnd() < 0.25) {
    // Damp stain or a hairline crack.
    if (rnd() < 0.5) softShadow(ctx, px + 3 + rnd() * 10, y + h * 0.6, 3 + rnd() * 3, 2, 0.12);
    else line(ctx, [px + 3 + rnd() * 10, y + 1, px + 5 + rnd() * 8, y + h * 0.5, px + 4 + rnd() * 9, y + h - 1], shade(face, -0.3), 0.25);
  }
}

function wallFaceHD(ctx: Ctx, px: number, py: number, style: number, rnd: () => number, tx: number, upper: boolean) {
  const { face, top } = WALL_COLORS[style] ?? WALL_COLORS[0];
  if (upper) {
    material(ctx, px, py, 2.6, T - 2.6, style, face, rnd, tx);
    // Cornice.
    rect(ctx, px, py, T, 2.6, vgrad(ctx, py, py + 2.6, [[0, shade(top, 0.25)], [0.5, shade(face, 0.15)], [1, shade(face, -0.15)]]));
    rect(ctx, px, py + 2.6, T, 0.8, 'rgba(0,0,0,0.2)');
    return;
  }
  // Wall cap seen from above, then the face.
  rect(ctx, px, py, T, 4, vgrad(ctx, py, py + 4, [[0, top], [0.75, shade(top, 0.12)], [1, shade(top, 0.35)]]));
  material(ctx, px, py, 4, 9.5, style, face, rnd, tx);
  rect(ctx, px, py + 4, T, 0.9, 'rgba(0,0,0,0.25)');
  baseboard(ctx, px, py + 13, face);
}

function baseboard(ctx: Ctx, px: number, y: number, face: string) {
  rect(ctx, px, y - 0.5, T, 3.5, vgrad(ctx, y - 0.5, y + 3, [[0, shade(face, -0.12)], [0.3, shade(face, -0.3)], [1, shade(face, -0.5)]]));
}

function lowerFacadeHD(ctx: Ctx, px: number, py: number, style: number, rnd: () => number, tx: number) {
  const { face } = WALL_COLORS[style] ?? WALL_COLORS[0];
  material(ctx, px, py, 0, 13.5, style, face, rnd, tx);
  baseboard(ctx, px, py + 13, face);
}

function wallTopHD(ctx: Ctx, m: PixelMap, px: number, py: number, x: number, y: number, style: number) {
  const { top } = WALL_COLORS[style] ?? WALL_COLORS[0];
  rect(ctx, px, py, T, T, top);
  const edge = shade(top, 0.3);
  const w = 1.4;
  if (!isWallish(tileAt(m, x - 1, y))) rect(ctx, px, py, w, T, hgrad(ctx, px, px + w, [[0, edge], [1, top]]));
  if (!isWallish(tileAt(m, x + 1, y))) rect(ctx, px + T - w, py, w, T, hgrad(ctx, px + T - w, px + T, [[0, top], [1, shade(top, -0.2)]]));
  if (!isWallish(tileAt(m, x, y - 1))) rect(ctx, px, py, T, w, vgrad(ctx, py, py + w, [[0, edge], [1, top]]));
}

/* ------------------------------------------------------------------ */
/* Tiles                                                               */
/* ------------------------------------------------------------------ */

export function drawTileHD(ctx: Ctx, m: PixelMap, x: number, y: number) {
  const t = tileAt(m, x, y);
  const st = styleAt(m, x, y);
  const px = x * T;
  const py = y * T;
  const rnd = seeded(hashString(`${m.id}:${x}:${y}`));
  switch (t) {
    case Tile.Void:
      rect(ctx, px, py, T, T, '#07090c');
      return;
    case Tile.Solid:
      rect(ctx, px, py, T, T, '#15181d');
      return;
    case Tile.Wall: {
      if (st & FACADE_UPPER) {
        wallFaceHD(ctx, px, py, st & 15, rnd, x, true);
        return;
      }
      const above = tileAt(m, x, y - 1);
      const below = tileAt(m, x, y + 1);
      if (isWallish(below)) wallTopHD(ctx, m, px, py, x, y, st);
      else if ((above === Tile.Wall && styleAt(m, x, y - 1) & FACADE_UPPER) || above === Tile.DoorTop) lowerFacadeHD(ctx, px, py, st, rnd, x);
      else wallFaceHD(ctx, px, py, st, rnd, x, false);
      return;
    }
    case Tile.DoorTop: {
      const style = st & 15;
      const { face, top } = WALL_COLORS[style] ?? WALL_COLORS[0];
      material(ctx, px, py, 2.6, T - 2.6, style, face, rnd, x);
      rect(ctx, px, py, T, 2.6, vgrad(ctx, py, py + 2.6, [[0, shade(top, 0.25)], [1, shade(face, -0.1)]]));
      // Frame and the dark doorway with warm light inside.
      fillRR(ctx, px + 1.2, py + 4.2, T - 2.4, T - 4.2, 0.8, shade(face, -0.45));
      rect(ctx, px + 2.2, py + 5.2, T - 4.4, T - 5.2, vgrad(ctx, py + 5, py + T, [[0, '#0f1115'], [0.6, '#1d1a17'], [1, '#2a2218']]));
      ctx.globalAlpha = 0.5;
      rect(ctx, px + 3, py + 6, T - 6, 3.5, vgrad(ctx, py + 6, py + 9.5, [[0, 'rgba(255,214,140,0.45)'], [1, 'rgba(255,214,140,0.05)']]));
      ctx.globalAlpha = 1;
      return;
    }
    case Tile.Floor:
      floorHD(ctx, px, py, st, rnd, x, y);
      return;
    case Tile.Door: {
      floorHD(ctx, px, py, st & 15, rnd, x, y);
      const wallStyle = st >> 4;
      const { face, top } = WALL_COLORS[wallStyle] ?? WALL_COLORS[0];
      const horizontal = isWallish(tileAt(m, x - 1, y)) || isWallish(tileAt(m, x + 1, y));
      if (tileAt(m, x, y - 1) === Tile.DoorTop) {
        const jamb = shade(face, -0.4);
        rect(ctx, px, py, 1.2, T, hgrad(ctx, px, px + 1.2, [[0, shade(face, -0.1)], [1, jamb]]));
        rect(ctx, px + T - 1.2, py, 1.2, T, hgrad(ctx, px + T - 1.2, px + T, [[0, jamb], [1, shade(face, -0.1)]]));
        fillRR(ctx, px + 1, py + T - 1.6, T - 2, 1.6, 0.5, vgrad(ctx, py + T - 1.6, py + T, [[0, '#8a857b'], [1, '#4a4741']]));
        return;
      }
      if (horizontal) {
        rect(ctx, px, py, T, 3, vgrad(ctx, py, py + 3, [[0, top], [1, shade(top, 0.25)]]));
        rect(ctx, px, py, 2, T, shade(face, -0.25));
        rect(ctx, px + T - 2, py, 2, T, shade(face, -0.25));
        fillRR(ctx, px + 2, py + 3, 3.2, 11, 0.6, vgrad(ctx, py + 3, py + 14, [[0, '#6e4b30'], [1, '#4a321f']]));
        ellipse(ctx, px + 4.3, py + 8.5, 0.5, 0.5, '#d6b25a');
      } else {
        rect(ctx, px, py, T, 2, shade(face, -0.25));
        rect(ctx, px, py + T - 2, T, 2, shade(face, -0.25));
      }
      return;
    }
    case Tile.Asphalt:
    case Tile.Marking:
    case Tile.Crosswalk: {
      rect(ctx, px, py, T, T, '#2b2e33');
      grain(ctx, px, py, T, T, 0.42);
      if (rnd() < 0.05) fillRR(ctx, px + rnd() * 6, py + rnd() * 6, 6 + rnd() * 6, 4 + rnd() * 5, 1.5, 'rgba(60,64,70,0.35)');
      if (rnd() < 0.06) softShadow(ctx, px + 4 + rnd() * 8, py + 4 + rnd() * 8, 3 + rnd() * 2.5, 1.8 + rnd(), 0.28);
      if (rnd() < 0.05) {
        const sx = px + rnd() * 10;
        line(ctx, [sx, py + 3 + rnd() * 4, sx + 2 + rnd() * 2, py + 7 + rnd() * 2, sx + 4 + rnd() * 3, py + 9 + rnd() * 3], 'rgba(10,10,12,0.5)', 0.3);
      }
      if (t === Tile.Marking) {
        ctx.globalAlpha = 0.85;
        if (st === 0) fillRR(ctx, px + 2.5, py + 7.2, 11, 1.6, 0.8, '#d9d2b0');
        else fillRR(ctx, px + 7.2, py + 2.5, 1.6, 11, 0.8, '#d9d2b0');
        ctx.globalAlpha = 1;
      }
      if (t === Tile.Crosswalk) {
        const stripe = '#dfdbd1';
        if (st === 0) {
          fillRR(ctx, px + 1.2, py - 0.01, 4.8, T + 0.02, 0.5, stripe);
          fillRR(ctx, px + 9.2, py - 0.01, 4.8, T + 0.02, 0.5, stripe);
        } else {
          fillRR(ctx, px - 0.01, py + 1.2, T + 0.02, 4.8, 0.5, stripe);
          fillRR(ctx, px - 0.01, py + 9.2, T + 0.02, 4.8, 0.5, stripe);
        }
        grain(ctx, px, py, T, T, 0.35);
      }
      return;
    }
    case Tile.Sidewalk: {
      const red = st === 1;
      const base = red ? '#7d645a' : '#736e66';
      const seam = red ? '#5a473f' : '#55514b';
      rect(ctx, px, py, T, T, seam);
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const v = (rnd() - 0.5) * 0.07 + ((i + j) % 2 ? -0.025 : 0.02);
          const sx = px + i * 8 + 0.3;
          const sy = py + j * 8 + 0.3;
          fillRR(ctx, sx, sy, 7.4, 7.4, 0.7, vgrad(ctx, sy, sy + 7.4, [[0, shade(base, v + 0.06)], [0.2, shade(base, v)], [1, shade(base, v - 0.05)]]));
        }
      grain(ctx, px, py, T, T, 0.35);
      const curb = (cx: number, cy: number, w: number, h: number, vertical: boolean, flip: boolean) => {
        const g = vertical
          ? hgrad(ctx, cx, cx + w, flip ? [[0, '#8c877d'], [0.6, '#b7b2a7'], [1, '#d0cbc0']] : [[0, '#d0cbc0'], [0.4, '#b7b2a7'], [1, '#8c877d']])
          : vgrad(ctx, cy, cy + h, flip ? [[0, '#8c877d'], [0.6, '#b7b2a7'], [1, '#d0cbc0']] : [[0, '#d0cbc0'], [0.4, '#b7b2a7'], [1, '#8c877d']]);
        rect(ctx, cx, cy, w, h, g);
      };
      if (isRoad(tileAt(m, x, y + 1))) curb(px, py + 13.2, T, 2.8, false, false);
      if (isRoad(tileAt(m, x, y - 1))) curb(px, py, T, 2.2, false, true);
      if (isRoad(tileAt(m, x - 1, y))) curb(px, py, 2.2, T, true, true);
      if (isRoad(tileAt(m, x + 1, y))) curb(px + T - 2.2, py, 2.2, T, true, false);
      return;
    }
    case Tile.Grass: {
      rect(ctx, px, py, T, T, '#2f4a2a');
      for (let i = 0; i < 3; i++) softShadow(ctx, px + rnd() * T, py + rnd() * T, 4 + rnd() * 4, 3 + rnd() * 2, 0.12);
      const blades = ['#3d5c35', '#2a4225', '#4a6d3f', '#36532f'];
      for (let i = 0; i < 34; i++) {
        const bx = px + rnd() * T;
        const by = py + 1 + rnd() * (T - 1);
        line(ctx, [bx, by, bx + (rnd() - 0.5) * 1.2, by - 1 - rnd() * 1.4], blades[Math.floor(rnd() * blades.length)], 0.4);
      }
      if (rnd() < 0.25) ellipse(ctx, px + 2 + rnd() * 12, py + 2 + rnd() * 12, 0.55, 0.55, rnd() < 0.5 ? '#e9e3b0' : '#c9a3e6');
      return;
    }
    case Tile.Dirt: {
      rect(ctx, px, py, T, T, '#5b4b3c');
      for (let i = 0; i < 3; i++) softShadow(ctx, px + rnd() * T, py + rnd() * T, 3 + rnd() * 4, 2 + rnd() * 2, 0.14);
      grain(ctx, px, py, T, T, 0.35);
      for (let i = 0; i < 6; i++) {
        const cx = px + rnd() * T;
        const cy = py + rnd() * T;
        const rad = 0.35 + rnd() * 0.5;
        ellipse(ctx, cx, cy + 0.15, rad, rad * 0.8, 'rgba(0,0,0,0.3)');
        ellipse(ctx, cx, cy, rad, rad * 0.8, rnd() < 0.5 ? '#7d6c58' : '#6a5a48');
      }
      return;
    }
    case Tile.Concrete:
    case Tile.Parking:
    case Tile.Platform: {
      rect(ctx, px, py, T, T, '#55575a');
      if (rnd() < 0.15) softShadow(ctx, px + 3 + rnd() * 10, py + 3 + rnd() * 10, 3 + rnd() * 3, 2, 0.22);
      grain(ctx, px, py, T, T, 0.34);
      rect(ctx, px, py, T, 0.35, '#45474a');
      rect(ctx, px, py, 0.35, T, '#45474a');
      if (t === Tile.Parking) {
        ctx.globalAlpha = 0.85;
        if (st === 0) fillRR(ctx, px - 0.4, py, 1, T, 0.4, '#d6d2c6');
        else fillRR(ctx, px, py - 0.4, T, 1, 0.4, '#d6d2c6');
        ctx.globalAlpha = 1;
      }
      if (t === Tile.Platform) {
        const sy = st === 0 ? py + 12.6 : py + 0.6;
        rect(ctx, px, sy, T, 2.8, '#c9a227');
        for (let i = 0; i < 8; i++) ellipse(ctx, px + 1 + i * 2, sy + 1.4, 0.45, 0.45, '#a8861c');
      }
      return;
    }
    case Tile.Dance: {
      const colors = ['#2c1844', '#13254a', '#3d1433', '#1b322c'];
      rect(ctx, px, py, T, T, '#0d0b12');
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const c = colors[(x * 2 + i + (y * 2 + j) * 3) % 4];
          const g = ctx.createRadialGradient(px + i * 8 + 4, py + j * 8 + 4, 0.5, px + i * 8 + 4, py + j * 8 + 4, 6);
          g.addColorStop(0, shade(c, 0.35));
          g.addColorStop(1, c);
          fillRR(ctx, px + i * 8 + 0.3, py + j * 8 + 0.3, 7.4, 7.4, 0.6, g);
        }
      return;
    }
  }
}

/** Shading that crosses tile borders: shadows at wall bases and under curbs. */
export function drawGroundOverlay(ctx: Ctx, m: PixelMap) {
  for (let y = 1; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const t = tileAt(m, x, y);
      if (t === Tile.Wall || t === Tile.Void || t === Tile.Solid || t === Tile.DoorTop) continue;
      const px = x * T;
      const py = y * T;
      const above = tileAt(m, x, y - 1);
      if (above === Tile.Wall) {
        rect(ctx, px, py, T, 4.5, vgrad(ctx, py, py + 4.5, [[0, 'rgba(0,0,0,0.38)'], [1, 'rgba(0,0,0,0)']]));
      } else if (isRoad(t) && above === Tile.Sidewalk) {
        rect(ctx, px, py, T, 2.2, vgrad(ctx, py, py + 2.2, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]));
      }
      if (isRoad(t) && tileAt(m, x - 1, y) === Tile.Sidewalk) rect(ctx, px, py, 1.6, T, hgrad(ctx, px, px + 1.6, [[0, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,0)']]));
      if (tileAt(m, x - 1, y) === Tile.Wall && (t === Tile.Floor || t === Tile.Door)) rect(ctx, px, py, 2.2, T, hgrad(ctx, px, px + 2.2, [[0, 'rgba(0,0,0,0.28)'], [1, 'rgba(0,0,0,0)']]));
      if (tileAt(m, x + 1, y) === Tile.Wall && (t === Tile.Floor || t === Tile.Door)) rect(ctx, px + T - 2.2, py, 2.2, T, hgrad(ctx, px + T - 2.2, px + T, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.28)']]));
    }
}

/* ------------------------------------------------------------------ */
/* Roofs                                                               */
/* ------------------------------------------------------------------ */

/** A building's roof, painted into ctx at world-pixel scale (origin = building corner). */
export function drawRoofHD(ctx: Ctx, b: Building) {
  const w = b.w * T;
  const h = (b.h - 2) * T;
  const rnd = seeded(b.seed);
  const base = b.roof;
  rect(ctx, 0, 0, w, h, vgrad(ctx, 0, h, [[0, shade(base, 0.05)], [1, shade(base, -0.06)]]));
  grain(ctx, 0, 0, w, h, 0.5);
  ctx.globalAlpha = 0.5;
  for (let x = 16; x < w - 4; x += 16) rect(ctx, x, 4, 0.35, h - 8, shade(base, -0.18));
  for (let y = 16; y < h - 4; y += 16) rect(ctx, 4, y, w - 8, 0.35, shade(base, -0.18));
  ctx.globalAlpha = 1;
  for (let i = 0; i < (w * h) / 1500; i++) softShadow(ctx, rnd() * w, rnd() * h, 6 + rnd() * 12, 4 + rnd() * 6, 0.12);

  // Parapet with a bevel.
  const par = shade(base, 0.22);
  ctx.save();
  rr(ctx, 0, 0, w, h, 1.5);
  rr(ctx, 3.5, 3.5, w - 7, h - 7, 1);
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, shade(par, 0.08)], [1, shade(par, -0.22)]]);
  ctx.fill('evenodd');
  ctx.restore();
  rect(ctx, 3.5, 3.5, w - 7, 1.4, 'rgba(0,0,0,0.3)');
  rect(ctx, 3.5, 3.5, 1.2, h - 7, 'rgba(0,0,0,0.22)');
  rect(ctx, 0, h - 1.2, w, 1.2, shade(base, -0.35));

  const placed: [number, number, number, number][] = [];
  const free = (x: number, y: number, iw: number, ih: number) =>
    x >= 6 && y >= 6 && x + iw <= w - 6 && y + ih <= h - 6 && !placed.some(([px, py, pw, ph]) => x < px + pw + 3 && x + iw + 3 > px && y < py + ph + 3 && y + ih + 3 > py);
  const place = (iw: number, ih: number, tries = 30): [number, number] | null => {
    for (let i = 0; i < tries; i++) {
      const x = 6 + Math.floor(rnd() * Math.max(1, w - iw - 12));
      const y = 6 + Math.floor(rnd() * Math.max(1, h - ih - 12));
      if (free(x, y, iw, ih)) {
        placed.push([x, y, iw, ih]);
        return [x, y];
      }
    }
    return null;
  };
  const drop = (x: number, y: number, iw: number, ih: number, rad = 1.5) => {
    ctx.globalAlpha = 0.35;
    fillRR(ctx, x + 2, y + 2.5, iw, ih, rad, '#000');
    ctx.globalAlpha = 0.2;
    fillRR(ctx, x + 1, y + 1.5, iw + 2, ih + 2, rad + 1, '#000');
    ctx.globalAlpha = 1;
  };

  if (b.w * b.h > 50) {
    const pos = place(26, 22);
    if (pos) {
      const [x, y] = pos;
      drop(x, y, 26, 22);
      fillRR(ctx, x, y, 26, 22, 1.2, shade(base, -0.12));
      fillRR(ctx, x, y, 26, 12.5, 1.2, vgrad(ctx, y, y + 12.5, [[0, shade(base, 0.25)], [1, shade(base, 0.08)]]));
      fillRR(ctx, x + 9, y + 13.5, 8, 8.5, 0.8, vgrad(ctx, y + 13, y + 22, [[0, '#4a3a2e'], [1, '#2f251d']]));
      ellipse(ctx, x + 15.2, y + 18, 0.6, 0.6, '#d6b25a');
    }
  }
  // Solar water heaters - the classic Tel Aviv roof.
  const heaters = Math.max(1, Math.floor((b.w * b.h) / 60));
  for (let k = 0; k < heaters; k++) {
    const n = 1 + Math.floor(rnd() * 3);
    const pos = place(n * 22, 18);
    if (!pos) continue;
    const [x0, y] = pos;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 22;
      drop(x, y, 20, 17);
      for (const px of [x, x + 10]) {
        const g = ctx.createLinearGradient(px, y + 6, px + 9, y + 17);
        g.addColorStop(0, '#3d6496');
        g.addColorStop(0.45, '#1c2c47');
        g.addColorStop(1, '#14203a');
        fillRR(ctx, px + 0.3, y + 6, 9, 11, 0.6, g);
        for (let j = 1; j < 4; j++) rect(ctx, px + 0.6, y + 6 + j * 2.75, 8.4, 0.25, 'rgba(150,180,220,0.35)');
        ctx.globalAlpha = 0.25;
        line(ctx, [px + 1.5, y + 15.5, px + 7.5, y + 7.5], '#cfe2ff', 0.6);
        ctx.globalAlpha = 1;
      }
      // Tank lying on top.
      fillRR(ctx, x - 1, y, 21, 6, 3, vgrad(ctx, y, y + 6, [[0, '#f6f4ee'], [0.5, '#d9d6cd'], [1, '#9c988e']]));
      ellipse(ctx, x + 19.2, y + 3, 0.9, 2.6, '#bdb9af');
    }
  }
  // Round black water tanks.
  for (let k = 0; k < Math.floor((b.w * b.h) / 90); k++) {
    const pos = place(13, 13);
    if (!pos) continue;
    const [x, y] = pos;
    softShadow(ctx, x + 8, y + 8.5, 8, 7, 0.45);
    const g = ctx.createRadialGradient(x + 4.5, y + 4.5, 0.5, x + 6.5, y + 6.5, 7);
    g.addColorStop(0, '#4a5059');
    g.addColorStop(0.5, '#262a30');
    g.addColorStop(1, '#16191d');
    ellipse(ctx, x + 6.5, y + 6.5, 6.5, 6.5, g);
    ellipse(ctx, x + 6.5, y + 6.5, 2.3, 2.3, '#1c1f24');
    ellipse(ctx, x + 6.2, y + 6.1, 1.6, 1.6, '#3a3f47');
  }
  // AC compressors.
  for (let k = 0; k < Math.floor((b.w * b.h) / 25); k++) {
    const pos = place(11, 9);
    if (!pos) continue;
    const [x, y] = pos;
    drop(x, y, 11, 9, 1);
    fillRR(ctx, x, y, 11, 9, 1, vgrad(ctx, y, y + 9, [[0, '#ecebe6'], [1, '#b9b6ad']]));
    const g = ctx.createRadialGradient(x + 4, y + 4.5, 0.3, x + 4, y + 4.5, 3.4);
    g.addColorStop(0, '#5f5c56');
    g.addColorStop(1, '#3d3b37');
    ellipse(ctx, x + 4, y + 4.5, 3.3, 3.3, g);
    line(ctx, [x + 2.2, y + 4.5, x + 5.8, y + 4.5], '#7a776f', 0.35);
    line(ctx, [x + 4, y + 2.7, x + 4, y + 6.3], '#7a776f', 0.35);
    for (let j = 0; j < 3; j++) rect(ctx, x + 8, y + 2.5 + j * 1.6, 2, 0.4, '#8a8780');
  }
  if (rnd() < 0.7) {
    const pos = place(10, 10);
    if (pos) {
      const [x, y] = pos;
      if (rnd() < 0.5) {
        softShadow(ctx, x + 6, y + 6.5, 5.5, 4.5, 0.4);
        const g = ctx.createRadialGradient(x + 3.5, y + 3.5, 0.3, x + 5, y + 5, 5);
        g.addColorStop(0, '#f2f0ea');
        g.addColorStop(1, '#a9a59c');
        ellipse(ctx, x + 5, y + 5, 4.5, 4.5, g);
        line(ctx, [x + 5, y + 5, x + 7.5, y + 2.5], '#55524c', 0.4);
        ellipse(ctx, x + 7.5, y + 2.5, 0.7, 0.7, '#55524c');
      } else {
        line(ctx, [x + 5, y, x + 5, y + 10], '#2b2f35', 0.6);
        line(ctx, [x, y + 2.5, x + 10, y + 2.5], '#2b2f35', 0.5);
        line(ctx, [x + 1.5, y + 5, x + 8.5, y + 5], '#2b2f35', 0.5);
        line(ctx, [x + 3, y + 7.2, x + 7, y + 7.2], '#2b2f35', 0.5);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

const CAR_COLORS = ['#8a1f25', '#c9c6bd', '#2d3a4d', '#1d1f23', '#6b6f75', '#3d5a3a', '#b48a3c', '#5a2d4a', '#e0ded6'];
const pickColor = (p: Prop) => CAR_COLORS[hashString(p.id) % CAR_COLORS.length];

function glass(ctx: Ctx, x: number, y: number, w: number, h: number, rad: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#5f7a96');
  g.addColorStop(0.35, '#22303f');
  g.addColorStop(1, '#141c26');
  fillRR(ctx, x, y, w, h, rad, g);
}

function wheel(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  ellipse(ctx, cx, cy, rx, ry, '#0c0d10');
  ellipse(ctx, cx, cy, rx * 0.55, ry * 0.55, '#4a4e56');
  ellipse(ctx, cx - rx * 0.12, cy - ry * 0.15, rx * 0.22, ry * 0.22, '#8e939c');
}

function carH(ctx: Ctx, px: number, py: number, body: string, police: boolean, t: number, left: boolean) {
  const x = px + 2;
  const w = 44;
  const top = py + 6;
  softShadow(ctx, x + w / 2 + 1, top + 21.5, 25, 5, 0.5);
  // Lower body / side.
  const side = vgrad(ctx, top + 9, top + 21, [[0, shade(body, -0.05)], [0.5, shade(body, -0.2)], [1, shade(body, -0.42)]]);
  fillRR(ctx, x, top + 4, w, 17, 4, side);
  // Upper surface.
  const upper = vgrad(ctx, top - 1, top + 12, [[0, shade(body, 0.22)], [0.6, body], [1, shade(body, -0.08)]]);
  fillRR(ctx, x + 0.5, top - 0.5, w - 1, 12.5, 5, upper);
  // Cabin roof between the windshield and the rear window, all inside the body outline.
  const cab = left ? x + 15 : x + 11;
  const front = left ? cab - 4.6 : cab + 18.4;
  const rear = left ? cab + 18.4 : cab - 3.8;
  const ws = (wx: number, ww: number, toward: number) => {
    // Slanted glass: wider where it meets the roof.
    const near = toward > 0 ? wx : wx + ww;
    const far = toward > 0 ? wx + ww : wx;
    ctx.beginPath();
    ctx.moveTo(near, top + 0.6);
    ctx.lineTo(far, top + 1.8);
    ctx.lineTo(far, top + 8.6);
    ctx.lineTo(near, top + 9.8);
    ctx.closePath();
    const g = ctx.createLinearGradient(wx, top, wx + ww, top + 10);
    g.addColorStop(0, '#5f7a96');
    g.addColorStop(0.4, '#22303f');
    g.addColorStop(1, '#141c26');
    ctx.fillStyle = g;
    ctx.fill();
  };
  ws(front, 4.2, left ? -1 : 1);
  ws(rear, 3.4, left ? 1 : -1);
  fillRR(ctx, cab, top + 0.4, 18, 9.6, 2.6, police ? vgrad(ctx, top, top + 10, [[0, '#ffffff'], [1, '#d9dbde']]) : vgrad(ctx, top, top + 10, [[0, shade(body, 0.3)], [1, shade(body, 0.06)]]));
  // Side windows and doors.
  glass(ctx, cab + 1, top + 11.2, 16, 3.4, 1.2);
  rect(ctx, cab + 9, top + 11, 0.5, 8.5, shade(body, -0.45));
  for (const hx of [cab + 6, cab + 13]) fillRR(ctx, hx, top + 15.2, 2.2, 0.8, 0.4, shade(body, 0.35));
  // Wheels peek out under the body.
  wheel(ctx, x + 9, top + 19.5, 4.2, 2.8);
  wheel(ctx, x + w - 9, top + 19.5, 4.2, 2.8);
  // Body highlight along the shoulder.
  ctx.globalAlpha = 0.35;
  line(ctx, [x + 4, top + 10.6, x + w - 4, top + 10.6], '#ffffff', 0.5);
  ctx.globalAlpha = 1;
  // Lights.
  const fx = left ? x + 0.6 : x + w - 2.6;
  const bx = left ? x + w - 2.6 : x + 0.6;
  fillRR(ctx, fx, top + 11.5, 2, 3.5, 0.8, '#fbf0c2');
  fillRR(ctx, bx, top + 11.5, 2, 3.5, 0.8, '#c8262e');
  if (police) {
    rect(ctx, x + 1, top + 15.2, w - 2, 2.2, '#1d4ed8');
    rect(ctx, x + 1, top + 17.4, w - 2, 0.8, '#93c5fd');
    const on = Math.floor(t * 3) % 2 === 0;
    fillRR(ctx, cab + 2.5, top + 3.4, 13, 3.2, 1.4, '#1b1d22');
    fillRR(ctx, cab + 3, top + 3.8, 5.8, 2.4, 1, on ? '#60a5fa' : '#1e3a8a');
    fillRR(ctx, cab + 9.2, top + 3.8, 5.8, 2.4, 1, on ? '#7f1d1d' : '#f87171');
  }
}

function carV(ctx: Ctx, px: number, py: number, body: string) {
  const x = px + 5;
  const w = 22;
  const y = py + 2;
  softShadow(ctx, x + w / 2 + 1.5, y + 26, 14, 22, 0.5);
  wheel(ctx, x + 0.5, y + 9, 1.8, 3.2);
  wheel(ctx, x + w - 0.5, y + 9, 1.8, 3.2);
  wheel(ctx, x + 0.5, y + 41, 1.8, 3.2);
  wheel(ctx, x + w - 0.5, y + 41, 1.8, 3.2);
  fillRR(ctx, x, y, w, 39, 5, hgrad(ctx, x, x + w, [[0, shade(body, -0.15)], [0.3, shade(body, 0.15)], [0.7, body], [1, shade(body, -0.25)]]));
  // Front face.
  fillRR(ctx, x, y + 34, w, 10, 4, vgrad(ctx, y + 34, y + 44, [[0, shade(body, -0.1)], [1, shade(body, -0.38)]]));
  fillRR(ctx, x + 3, y + 9, w - 6, 17, 3, hgrad(ctx, x, x + w, [[0, shade(body, 0.05)], [0.4, shade(body, 0.3)], [1, shade(body, 0.02)]]));
  glass(ctx, x + 3, y + 6, w - 6, 5, 2);
  glass(ctx, x + 3, y + 24.5, w - 6, 5, 2);
  fillRR(ctx, x + 1, y + 39.5, 4.5, 2, 0.9, '#fbf0c2');
  fillRR(ctx, x + w - 5.5, y + 39.5, 4.5, 2, 0.9, '#fbf0c2');
  fillRR(ctx, x + 7, y + 40, 8, 2.2, 0.8, shade(body, -0.5));
  fillRR(ctx, x + 2, y + 0.4, 3.5, 1.2, 0.5, '#c8262e');
  fillRR(ctx, x + w - 5.5, y + 0.4, 3.5, 1.2, 0.5, '#c8262e');
}

function tree(ctx: Ctx, px: number, py: number, color: string, lemon: boolean, seed: number) {
  const rnd = seeded(seed);
  softShadow(ctx, px + 9, py + 11, 14, 5, 0.45);
  // Trunk.
  fillRR(ctx, px + 6.3, py - 6, 3.6, 18.5, 1.5, hgrad(ctx, px + 6, px + 10, [[0, '#5e412b'], [0.5, '#4a3221'], [1, '#2f1f14']]));
  // Canopy: overlapping soft blobs, dark below, light on top.
  const g = color;
  const cx = px + 8;
  const cy = py - (lemon ? 10 : 14);
  const R = lemon ? 10 : 13;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd();
    blobs.push([cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.42, R * (0.45 + rnd() * 0.18)]);
  }
  blobs.push([cx, cy, R * 0.6]);
  for (const [bx, by, br] of blobs) ellipse(ctx, bx + 0.8, by + 1.6, br, br * 0.9, shade(g, -0.38));
  for (const [bx, by, br] of blobs) {
    const gg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.45, br * 0.1, bx, by, br);
    gg.addColorStop(0, shade(g, 0.28));
    gg.addColorStop(0.55, g);
    gg.addColorStop(1, shade(g, -0.22));
    ellipse(ctx, bx, by, br, br * 0.9, gg);
  }
  // Leaf flecks.
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * R * 0.95;
    ellipse(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, 0.9, 0.6, rnd() < 0.5 ? shade(g, 0.32) : shade(g, -0.3));
  }
  if (lemon)
    for (let i = 0; i < 8; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * R * 0.8;
      const lx = cx + Math.cos(a) * d;
      const ly = cy + Math.sin(a) * d * 0.8;
      ellipse(ctx, lx, ly, 1.2, 1, '#f5d742');
      ellipse(ctx, lx - 0.3, ly - 0.3, 0.45, 0.35, '#fff6bf');
    }
}

export type VectorDraw = (ctx: Ctx, px: number, py: number, p: Prop, t: number) => void;

export const VECTOR_PROPS: Record<string, VectorDraw> = {
  car(ctx, px, py, p, t) {
    carH(ctx, px, py, p.color ?? pickColor(p), false, t, (p.variant ?? 0) === 1);
  },
  policeCar(ctx, px, py, p, t) {
    carH(ctx, px, py, '#e7e5df', true, t, (p.variant ?? 0) === 1);
  },
  carV(ctx, px, py, p) {
    carV(ctx, px, py, p.color ?? pickColor(p));
  },
  van(ctx, px, py, p) {
    const c = p.color ?? '#9aa3ad';
    const x = px + 2;
    const w = 60;
    const top = py + 3;
    softShadow(ctx, x + w / 2 + 1, top + 25, 33, 5.5, 0.5);
    fillRR(ctx, x, top + 6, w, 18, 3.5, vgrad(ctx, top + 10, top + 24, [[0, shade(c, -0.05)], [0.5, shade(c, -0.18)], [1, shade(c, -0.4)]]));
    fillRR(ctx, x + 0.5, top, w - 1, 14.5, 3, vgrad(ctx, top, top + 14, [[0, shade(c, 0.22)], [1, shade(c, 0.02)]]));
    glass(ctx, x + w - 14.5, top + 1, 5, 12.5, 2);
    glass(ctx, x + w - 13.5, top + 14.6, 11, 4, 1.2);
    fillRR(ctx, x + 6, top + 16, 30, 4.5, 1.2, shade(c, -0.3));
    wheel(ctx, x + 10.5, top + 23, 4.5, 3);
    wheel(ctx, x + w - 10.5, top + 23, 4.5, 3);
    fillRR(ctx, x + w - 2.4, top + 15, 2, 3.5, 0.8, '#fbf0c2');
    fillRR(ctx, x + 0.4, top + 15, 2, 3.5, 0.8, '#c8262e');
  },
  lamp(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 4.5, 1.8, 0.5);
    fillRR(ctx, px + 5.6, py + 8.6, 4.8, 4.4, 1.2, vgrad(ctx, py + 8, py + 13, [[0, '#4a5059'], [1, '#22262b']]));
    fillRR(ctx, px + 7, py - 22, 2, 31, 1, hgrad(ctx, px + 7, px + 9, [[0, '#59606a'], [0.5, '#3a3f46'], [1, '#22262b']]));
    ctx.beginPath();
    ctx.moveTo(px + 8, py - 21);
    ctx.quadraticCurveTo(px + 8.5, py - 23.5, px + 12, py - 22.6);
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
    fillRR(ctx, px + 10.4, py - 23.2, 5, 3, 1.4, vgrad(ctx, py - 23, py - 20, [[0, '#4a5059'], [1, '#22262b']]));
    fillRR(ctx, px + 11, py - 20.6, 3.8, 1.2, 0.6, '#ffefb8');
  },
  tree(ctx, px, py, p) {
    tree(ctx, px, py, p.color ?? '#2e4d28', false, hashString(p.id));
  },
  lemonTree(ctx, px, py, p) {
    tree(ctx, px, py, '#355d2c', true, hashString(p.id));
  },
  palm(ctx, px, py, p) {
    softShadow(ctx, px + 8, py + 11, 11, 4, 0.45);
    for (let i = 0; i < 11; i++) {
      const y = py + 10 - i * 3;
      fillRR(ctx, px + 6 - i * 0.05, y, 4, 3.4, 1.2, hgrad(ctx, px + 6, px + 10, [[0, '#7a5e3f'], [1, '#4a3826']]));
    }
    const rnd = seeded(hashString(p.id));
    const cx = px + 8;
    const cy = py - 24;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
      const len = 11 + rnd() * 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.6, cy + Math.sin(a) * len * 0.4 - 3, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.55 + 2);
      ctx.strokeStyle = i % 2 ? '#3f6b33' : '#4f8240';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ellipse(ctx, cx, cy, 2, 1.6, '#5a4430');
  },
  bench(ctx, px, py) {
    softShadow(ctx, px + 16.5, py + 12.5, 15, 2.8, 0.42);
    for (const lx of [px + 4, px + 26]) fillRR(ctx, lx, py + 9, 2, 5, 0.6, '#26282c');
    for (const [sy, sh] of [[py + 1.5, 3], [py + 5.5, 3], [py + 9, 2.2]] as const)
      fillRR(ctx, px + 2, sy, 28, sh, 1, vgrad(ctx, sy, sy + sh, [[0, '#9a6e48'], [1, '#6a4a30']]));
  },
  trash(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 6.5, 2.2, 0.45);
    fillRR(ctx, px + 3, py - 0.5, 10, 13, 1.6, hgrad(ctx, px + 3, px + 13, [[0, '#2a5034'], [0.4, '#3f7550'], [1, '#1f3d28']]));
    fillRR(ctx, px + 2.2, py - 2.5, 11.6, 3.2, 1.2, vgrad(ctx, py - 2.5, py + 0.7, [[0, '#4d8a5c'], [1, '#2f5a3a']]));
    for (const lx of [px + 5.5, px + 8, px + 10.5]) rect(ctx, lx, py + 2.5, 0.4, 8, 'rgba(0,0,0,0.25)');
  },
  dumpster(ctx, px, py) {
    softShadow(ctx, px + 16.5, py + 12.5, 17, 3, 0.5);
    fillRR(ctx, px + 1, py - 4, 30, 16.5, 1.8, vgrad(ctx, py - 4, py + 12.5, [[0, '#2f6b4b'], [1, '#1b3f2c']]));
    fillRR(ctx, px, py - 6.5, 32, 3.6, 1.4, vgrad(ctx, py - 6.5, py - 3, [[0, '#3f8a62'], [1, '#24543b']]));
    rect(ctx, px + 4, py - 1, 24, 0.5, 'rgba(0,0,0,0.3)');
    fillRR(ctx, px + 6, py + 3, 9, 3, 0.6, '#e5e7eb');
    rect(ctx, px + 7, py + 4, 2, 1, '#dc2626');
    for (const wx of [px + 4, px + 28]) ellipse(ctx, wx, py + 12.5, 1.4, 1.1, '#111');
  },
  barrel(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 6.5, 2.3, 0.45);
    fillRR(ctx, px + 3, py - 2, 10, 14, 2.5, hgrad(ctx, px + 3, px + 13, [[0, '#5a2410'], [0.35, '#a1461c'], [1, '#4a1d0c']]));
    for (const ry of [py + 2, py + 7]) rect(ctx, px + 3, ry, 10, 0.6, 'rgba(0,0,0,0.35)');
    ellipse(ctx, px + 8, py - 2, 5, 1.4, '#3a1607');
    ellipse(ctx, px + 8, py - 2.2, 4, 0.9, '#141414');
  },
  crate(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 7.5, 2.4, 0.45);
    const wood = (x: number, y: number, w: number, h: number) => {
      fillRR(ctx, x, y, w, h, 0.8, vgrad(ctx, y, y + h, [[0, '#ad8a58'], [1, '#7a5c35']]));
      for (let i = 1; i < 3; i++) rect(ctx, x + 0.5, y + (h * i) / 3, w - 1, 0.4, 'rgba(60,40,20,0.5)');
    };
    wood(px + 2, py + 1, 12, 11);
    wood(px + 4, py - 5, 9, 6.5);
  },
  scooter(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12, 7.5, 2, 0.45);
    wheel(ctx, px + 3, py + 11.2, 1.8, 1.8);
    wheel(ctx, px + 13.5, py + 11.2, 1.8, 1.8);
    fillRR(ctx, px + 2, py + 8.6, 12, 2.2, 1, vgrad(ctx, py + 8.6, py + 10.8, [[0, '#374151'], [1, '#111827']]));
    rect(ctx, px + 4, py + 8.6, 6, 0.6, '#22c55e');
    line(ctx, [px + 13, py + 9, px + 12.6, py - 2], '#4b5563', 1.2);
    line(ctx, [px + 10.2, py - 2.8, px + 15.6, py - 2.8], '#111827', 1);
  },
  plant(ctx, px, py, p) {
    softShadow(ctx, px + 8.5, py + 13, 6, 2, 0.45);
    ctx.beginPath();
    ctx.moveTo(px + 3.6, py + 6.8);
    ctx.lineTo(px + 12.4, py + 6.8);
    ctx.lineTo(px + 11.2, py + 13);
    ctx.lineTo(px + 4.8, py + 13);
    ctx.closePath();
    ctx.fillStyle = hgrad(ctx, px + 4, px + 12, [[0, '#a65f36'], [1, '#6e3a1e']]);
    ctx.fill();
    fillRR(ctx, px + 3.2, py + 6.2, 9.6, 1.6, 0.6, '#b8703f');
    const rnd = seeded(hashString(p.id));
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
      const len = 5 + rnd() * 5;
      const bx = px + 8 + Math.cos(a) * len;
      const by = py + 5 + Math.sin(a) * len;
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.4, 1.1, a, 0, Math.PI * 2);
      ctx.fillStyle = rnd() < 0.5 ? '#3c7034' : '#2f5d2a';
      ctx.fill();
    }
  },
  cafeTable(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12, 8, 2.6, 0.42);
    for (const cx of [px + 1.5, px + 14.5]) fillRR(ctx, cx - 1.5, py + 4, 3, 7, 1, vgrad(ctx, py + 4, py + 11, [[0, '#dc3a3a'], [1, '#8f1515']]));
    line(ctx, [px + 8, py + 7, px + 8, py + 11.5], '#9ca3af', 0.9);
    ellipse(ctx, px + 8, py + 5, 5.2, 3.2, '#c9ccd2');
    ellipse(ctx, px + 8, py + 4.6, 5, 2.9, '#eceef1');
    ellipse(ctx, px + 6.4, py + 4.4, 0.9, 0.7, '#92400e');
  },
  planter(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 8, 2.4, 0.45);
    fillRR(ctx, px + 1, py + 3, 14, 10, 1.4, vgrad(ctx, py + 3, py + 13, [[0, '#9a9c9f'], [1, '#606265']]));
    ellipse(ctx, px + 8, py + 1, 6.5, 3.4, '#3c5a2f');
    ellipse(ctx, px + 6, py - 1, 3, 2.2, '#4c7039');
  },
  hydrant(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 11.5, 4.5, 1.6, 0.45);
    fillRR(ctx, px + 6, py + 1, 5, 11, 1.5, hgrad(ctx, px + 6, px + 11, [[0, '#a37a10'], [0.4, '#e2b329'], [1, '#8a6609']]));
    ellipse(ctx, px + 8.5, py + 1, 3.4, 1.4, '#b8860b');
    fillRR(ctx, px + 4, py + 5, 9, 2, 0.9, '#b8860b');
  },
  pillar(ctx, px, py) {
    softShadow(ctx, px + 8.5, py + 12.5, 8, 3, 0.45);
    fillRR(ctx, px + 2, py - 18, 12, 31, 0.8, hgrad(ctx, px + 2, px + 14, [[0, '#888a8d'], [0.3, '#717376'], [1, '#4f5154']]));
    rect(ctx, px + 2, py + 6, 12, 2, 'rgba(0,0,0,0.25)');
    grain(ctx, px + 2, py - 18, 12, 31, 0.4);
    rect(ctx, px + 5, py - 6, 4, 0.8, '#7c3a2d');
  },
  busStop(ctx, px, py) {
    softShadow(ctx, px + 24.5, py + 12.5, 25, 3, 0.42);
    for (const lx of [px + 2, px + 45]) fillRR(ctx, lx, py - 11, 1.2, 24, 0.5, '#4b5563');
    fillRR(ctx, px + 3, py - 11, 42, 14, 1, 'rgba(147,197,253,0.16)');
    ctx.globalAlpha = 0.3;
    line(ctx, [px + 6, py + 1, px + 14, py - 9], '#e0f2fe', 0.6);
    line(ctx, [px + 18, py + 1, px + 24, py - 6], '#e0f2fe', 0.4);
    ctx.globalAlpha = 1;
    fillRR(ctx, px + 1, py - 14.5, 46, 3.5, 1.2, vgrad(ctx, py - 14.5, py - 11, [[0, '#3d5468'], [1, '#22313f']]));
    fillRR(ctx, px + 30, py - 10, 12, 10, 0.8, '#f5f5f4');
    fillRR(ctx, px + 31, py - 9, 10, 2, 0.5, '#16a34a');
    for (let i = 0; i < 3; i++) rect(ctx, px + 31.5, py - 5.5 + i * 1.6, 9, 0.4, '#a8a29e');
    fillRR(ctx, px + 6, py + 4.6, 20, 3.2, 1, vgrad(ctx, py + 4.6, py + 7.8, [[0, '#8b929c'], [1, '#4b5563']]));
  },
};
