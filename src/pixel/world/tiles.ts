// Ground and wall tile painting for the static map layer.
import { hashString, seeded, shade } from '../color';
import { FACADE_UPPER, FloorStyle, T, Tile, WallStyle, type PixelMap } from './types';

type Ctx = CanvasRenderingContext2D;

export const WALL_COLORS: Record<number, { face: string; top: string }> = {
  [WallStyle.Station]: { face: '#8d959c', top: '#3a414b' },
  [WallStyle.Plaster]: { face: '#b9a98a', top: '#4a4238' },
  [WallStyle.White]: { face: '#c6c3ba', top: '#4b4a47' },
  [WallStyle.Brick]: { face: '#7d4332', top: '#3e2a24' },
  [WallStyle.Concrete]: { face: '#717375', top: '#36383b' },
  [WallStyle.Club]: { face: '#2e2a35', top: '#17151b' },
  [WallStyle.Stone]: { face: '#c2ad84', top: '#4e4535' },
  [WallStyle.BlueTile]: { face: '#4d6a7a', top: '#29343c' },
  [WallStyle.Pink]: { face: '#b98f86', top: '#4a3634' },
};

const FLOORS: Record<number, [string, string, string]> = {
  [FloorStyle.Tile]: ['#3e4652', '#363d48', '#465060'],
  [FloorStyle.Lab]: ['#c3cad0', '#aeb6bf', '#d3d9de'],
  [FloorStyle.Wood]: ['#6a4a30', '#583c26', '#7a5739'],
  [FloorStyle.Carpet]: ['#2e394b', '#283244', '#354258'],
  [FloorStyle.Checker]: ['#8a8f99', '#2c2f36', '#9aa0aa'],
  [FloorStyle.Concrete]: ['#4b4c4e', '#424345', '#555658'],
  [FloorStyle.Club]: ['#1f1b25', '#18151d', '#29232f'],
  [FloorStyle.Lino]: ['#4a5560', '#404a54', '#56626e'],
  [FloorStyle.Terrazzo]: ['#6d6458', '#5f574c', '#7c7366'],
};

function r(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function noise(ctx: Ctx, px: number, py: number, rnd: () => number, colors: string[], count: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    ctx.fillRect(px + Math.floor(rnd() * T), py + Math.floor(rnd() * T), 1, 1);
  }
}

export function tileAt(m: PixelMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return Tile.Void;
  return m.tiles[y * m.w + x];
}

export function styleAt(m: PixelMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return 0;
  return m.style[y * m.w + x];
}

const isWallish = (t: number) => t === Tile.Wall || t === Tile.Void || t === Tile.Solid;

/** Lower facade row directly under an upper facade tile continues the face without a top cap. */
function drawLowerFacade(ctx: Ctx, px: number, py: number, style: number, rnd: () => number) {
  const { face } = WALL_COLORS[style] ?? WALL_COLORS[0];
  const faceShade = shade(face, -0.18);
  r(ctx, px, py, T, 13, face);
  noise(ctx, px, py, rnd, [faceShade, shade(face, 0.08)], 5);
  if (style === WallStyle.Brick)
    for (let row = 0; row < 4; row++) {
      r(ctx, px, py + 2 + row * 3, T, 1, faceShade);
      for (let x = row % 2 ? 0 : 4; x < T; x += 8) r(ctx, px + x, py + row * 3, 1, 2, faceShade);
    }
  if (style === WallStyle.Station) {
    r(ctx, px, py + 8, T, 3, '#5d6f86');
    r(ctx, px, py + 8, T, 1, '#7487a0');
  }
  r(ctx, px, py + 13, T, 1, faceShade);
  r(ctx, px, py + 14, T, 2, shade(face, -0.38));
}

function drawFloor(ctx: Ctx, px: number, py: number, style: number, rnd: () => number, tx: number, ty: number) {
  const [base, dark, light] = FLOORS[style] ?? FLOORS[FloorStyle.Tile];
  r(ctx, px, py, T, T, base);
  switch (style) {
    case FloorStyle.Tile:
    case FloorStyle.Lab:
      r(ctx, px, py, T, 1, dark);
      r(ctx, px, py, 1, T, dark);
      r(ctx, px, py + 8, T, 1, dark);
      r(ctx, px + 8, py, 1, T, dark);
      noise(ctx, px, py, rnd, [light, dark], 4);
      break;
    case FloorStyle.Wood:
      for (let i = 0; i < 4; i++) {
        r(ctx, px, py + i * 4 + 3, T, 1, dark);
        const off = ((ty * 4 + i) * 7 + tx * 16) % 16;
        r(ctx, px + off, py + i * 4, 1, 3, dark);
        if (rnd() < 0.5) r(ctx, px + Math.floor(rnd() * 14), py + i * 4 + 1, 2, 1, light);
      }
      break;
    case FloorStyle.Carpet:
    case FloorStyle.Club:
      noise(ctx, px, py, rnd, [light, dark], 26);
      break;
    case FloorStyle.Checker:
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if ((i + j) % 2 === 0) r(ctx, px + i * 8, py + j * 8, 8, 8, dark);
      break;
    case FloorStyle.Concrete:
      noise(ctx, px, py, rnd, [light, dark], 18);
      if (rnd() < 0.15) r(ctx, px + 3, py + 5, 6, 1, dark);
      break;
    case FloorStyle.Lino:
      r(ctx, px, py, T, 1, dark);
      noise(ctx, px, py, rnd, [light, dark], 8);
      break;
    case FloorStyle.Terrazzo:
      noise(ctx, px, py, rnd, [light, dark, '#8a7f70', '#4f4840'], 30);
      break;
  }
}

function drawWallFace(ctx: Ctx, px: number, py: number, style: number, rnd: () => number, tx: number, upper = false) {
  const { face, top } = WALL_COLORS[style] ?? WALL_COLORS[0];
  const faceShade = shade(face, -0.18);
  if (upper) {
    // Upper storey of a facade: plain face with a cornice line on top.
    r(ctx, px, py, T, T, face);
    r(ctx, px, py, T, 2, shade(top, 0.15));
    r(ctx, px, py + 2, T, 1, shade(face, 0.15));
    r(ctx, px, py + 15, T, 1, faceShade);
    noise(ctx, px, py + 3, rnd, [faceShade, shade(face, 0.08)], 5);
    if (style === WallStyle.Brick)
      for (let row = 0; row < 4; row++) {
        r(ctx, px, py + 5 + row * 3, T, 1, faceShade);
        for (let x = (row + tx) % 2 ? 0 : 4; x < T; x += 8) r(ctx, px + x, py + 3 + row * 3, 1, 2, faceShade);
      }
    if (style === WallStyle.Stone) {
      r(ctx, px, py + 8, T, 1, faceShade);
      r(ctx, px + ((tx % 2) ? 5 : 11), py + 3, 1, 5, faceShade);
      r(ctx, px + ((tx % 2) ? 12 : 3), py + 9, 1, 6, faceShade);
    }
    if (style === WallStyle.Station) {
      r(ctx, px, py + 12, T, 1, '#5d6f86');
    }
    return;
  }
  r(ctx, px, py, T, 4, top);
  r(ctx, px, py + 3, T, 1, shade(top, 0.25));
  r(ctx, px, py + 4, T, 10, face);
  r(ctx, px, py + 4, T, 1, shade(face, 0.12));
  r(ctx, px, py + 13, T, 1, faceShade);
  r(ctx, px, py + 14, T, 2, shade(face, -0.38));
  if (style === WallStyle.Brick) {
    for (let row = 0; row < 3; row++) {
      const y = py + 5 + row * 3;
      r(ctx, px, y + 2, T, 1, faceShade);
      const off = (row + tx) % 2 ? 0 : 4;
      for (let x = off; x < T; x += 8) r(ctx, px + x, y, 1, 2, faceShade);
    }
  } else if (style === WallStyle.Stone) {
    r(ctx, px, py + 8, T, 1, faceShade);
    r(ctx, px + ((tx % 2) ? 5 : 11), py + 4, 1, 4, faceShade);
    r(ctx, px + ((tx % 2) ? 12 : 3), py + 9, 1, 4, faceShade);
  } else if (style === WallStyle.BlueTile) {
    for (let x = 0; x < T; x += 4) r(ctx, px + x, py + 4, 1, 10, faceShade);
    r(ctx, px, py + 9, T, 1, faceShade);
  } else if (style === WallStyle.Station) {
    r(ctx, px, py + 10, T, 3, '#5d6f86');
    r(ctx, px, py + 10, T, 1, '#7487a0');
  } else {
    noise(ctx, px, py + 4, rnd, [faceShade, shade(face, 0.08)], 6);
    if (rnd() < 0.18) r(ctx, px + 2 + Math.floor(rnd() * 10), py + 6, 1, 4 + Math.floor(rnd() * 4), faceShade);
  }
}

function drawWallTop(ctx: Ctx, m: PixelMap, px: number, py: number, x: number, y: number, style: number) {
  const { top } = WALL_COLORS[style] ?? WALL_COLORS[0];
  r(ctx, px, py, T, T, top);
  const edge = shade(top, 0.28);
  if (!isWallish(tileAt(m, x - 1, y))) r(ctx, px, py, 1, T, edge);
  if (!isWallish(tileAt(m, x + 1, y))) r(ctx, px + T - 1, py, 1, T, edge);
  if (!isWallish(tileAt(m, x, y - 1))) r(ctx, px, py, T, 1, edge);
}

export function drawTile(ctx: Ctx, m: PixelMap, x: number, y: number) {
  const t = tileAt(m, x, y);
  const st = styleAt(m, x, y);
  const px = x * T;
  const py = y * T;
  const rnd = seeded(hashString(`${m.id}:${x}:${y}`));
  switch (t) {
    case Tile.Void:
      r(ctx, px, py, T, T, '#07090c');
      return;
    case Tile.Solid:
      r(ctx, px, py, T, T, '#15181d');
      return;
    case Tile.Wall: {
      if (st & FACADE_UPPER) {
        drawWallFace(ctx, px, py, st & 15, rnd, x, true);
        return;
      }
      const above = tileAt(m, x, y - 1);
      const below = tileAt(m, x, y + 1);
      if (isWallish(below)) drawWallTop(ctx, m, px, py, x, y, st);
      else if ((above === Tile.Wall && styleAt(m, x, y - 1) & FACADE_UPPER) || above === Tile.DoorTop) drawLowerFacade(ctx, px, py, st, rnd);
      else drawWallFace(ctx, px, py, st, rnd, x);
      return;
    }
    case Tile.DoorTop: {
      const { face, top } = WALL_COLORS[st & 15] ?? WALL_COLORS[0];
      r(ctx, px, py, T, T, shade(face, -0.1));
      r(ctx, px, py, T, 2, shade(top, 0.15));
      r(ctx, px + 2, py + 5, T - 4, 11, '#15171c');
      r(ctx, px + 1, py + 4, T - 2, 1, shade(face, -0.4));
      r(ctx, px + 1, py + 5, 1, 11, shade(face, -0.35));
      r(ctx, px + T - 2, py + 5, 1, 11, shade(face, -0.35));
      r(ctx, px + 3, py + 7, T - 6, 4, 'rgba(255,214,140,0.25)');
      return;
    }
    case Tile.Floor:
      drawFloor(ctx, px, py, st, rnd, x, y);
      return;
    case Tile.Door: {
      drawFloor(ctx, px, py, st & 15, rnd, x, y);
      const wallStyle = st >> 4;
      const { face, top } = WALL_COLORS[wallStyle] ?? WALL_COLORS[0];
      const horizontal = isWallish(tileAt(m, x - 1, y)) || isWallish(tileAt(m, x + 1, y));
      if (tileAt(m, x, y - 1) === Tile.DoorTop) {
        r(ctx, px, py, 1, T, shade(face, -0.35));
        r(ctx, px + T - 1, py, 1, T, shade(face, -0.35));
        r(ctx, px + 1, py + T - 1, T - 2, 1, '#2a2d33');
        return;
      }
      if (horizontal) {
        r(ctx, px, py, T, 3, top);
        r(ctx, px, py, 2, T, shade(face, -0.25));
        r(ctx, px + T - 2, py, 2, T, shade(face, -0.25));
        r(ctx, px + 2, py + 3, 3, 11, '#5a3d27');
        r(ctx, px + 4, py + 8, 1, 1, '#c9a54a');
        r(ctx, px + 2, py + T - 1, T - 4, 1, '#22252b');
      } else {
        r(ctx, px, py, T, 2, shade(face, -0.25));
        r(ctx, px, py + T - 2, T, 2, shade(face, -0.25));
      }
      return;
    }
    case Tile.Asphalt:
    case Tile.Marking:
    case Tile.Crosswalk: {
      r(ctx, px, py, T, T, '#2a2d32');
      noise(ctx, px, py, rnd, ['#33373d', '#24272b', '#3a3e44'], 22);
      if (rnd() < 0.06) r(ctx, px + 3, py + 9, 7, 1, '#202226');
      if (t === Tile.Marking) {
        if (st === 0) r(ctx, px + 2, py + 7, 10, 2, '#c9c2a2');
        else r(ctx, px + 7, py + 2, 2, 10, '#c9c2a2');
      }
      if (t === Tile.Crosswalk) {
        if (st === 0) {
          r(ctx, px + 1, py, 5, T, '#d8d4c8');
          r(ctx, px + 9, py, 5, T, '#d8d4c8');
        } else {
          r(ctx, px, py + 1, T, 5, '#d8d4c8');
          r(ctx, px, py + 9, T, 5, '#d8d4c8');
        }
        noise(ctx, px, py, rnd, ['#9b978d'], 10);
      }
      return;
    }
    case Tile.Sidewalk: {
      const red = st === 1;
      const base = red ? '#7a6157' : '#6f6a62';
      const alt = red ? '#705850' : '#67625a';
      const seam = red ? '#5e4a43' : '#57534d';
      r(ctx, px, py, T, T, base);
      r(ctx, px, py, 8, 8, alt);
      r(ctx, px + 8, py + 8, 8, 8, alt);
      r(ctx, px, py + 7, T, 1, seam);
      r(ctx, px, py + 15, T, 1, seam);
      r(ctx, px + 7, py, 1, 8, seam);
      r(ctx, px + 15, py + 8, 1, 8, seam);
      noise(ctx, px, py, rnd, [seam, shade(base, 0.08)], 5);
      const road = (tt: number) => tt === Tile.Asphalt || tt === Tile.Marking || tt === Tile.Crosswalk;
      if (road(tileAt(m, x, y + 1))) {
        r(ctx, px, py + 13, T, 2, '#a29d93');
        r(ctx, px, py + 15, T, 1, '#3a3a3c');
      }
      if (road(tileAt(m, x, y - 1))) r(ctx, px, py, T, 2, '#a29d93');
      if (road(tileAt(m, x - 1, y))) r(ctx, px, py, 2, T, '#a29d93');
      if (road(tileAt(m, x + 1, y))) r(ctx, px + T - 2, py, 2, T, '#a29d93');
      return;
    }
    case Tile.Grass:
      r(ctx, px, py, T, T, '#2e4429');
      noise(ctx, px, py, rnd, ['#3a5533', '#263a22', '#46633c'], 34);
      return;
    case Tile.Dirt:
      r(ctx, px, py, T, T, '#58493a');
      noise(ctx, px, py, rnd, ['#665645', '#4b3e31', '#7b6b58'], 20);
      return;
    case Tile.Concrete:
    case Tile.Parking:
    case Tile.Platform: {
      r(ctx, px, py, T, T, '#525457');
      noise(ctx, px, py, rnd, ['#5b5d60', '#494b4e', '#45474a'], 20);
      if (rnd() < 0.1) r(ctx, px + 2, py + 4, 1, 6, '#3f4144');
      if (rnd() < 0.08) {
        ctx.fillStyle = 'rgba(20,20,24,0.35)';
        ctx.fillRect(px + 4, py + 6, 6, 4);
      }
      if (t === Tile.Parking) {
        if (st === 0) r(ctx, px, py, 1, T, '#cfcbbf');
        else r(ctx, px, py, T, 1, '#cfcbbf');
      }
      if (t === Tile.Platform) {
        if (st === 0) r(ctx, px, py + 13, T, 2, '#c9a227');
        else r(ctx, px, py + 1, T, 2, '#c9a227');
      }
      return;
    }
    case Tile.Dance: {
      const colors = ['#2a1840', '#13243f', '#3a1430', '#1b2f2a'];
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) r(ctx, px + i * 8, py + j * 8, 8, 8, colors[(x * 2 + i + (y * 2 + j) * 3) % 4]);
      r(ctx, px, py, T, 1, '#0d0b12');
      r(ctx, px, py, 1, T, '#0d0b12');
      return;
    }
  }
}
