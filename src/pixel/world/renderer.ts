// Draws a PixelMap: cached ground layer, y-sorted props and characters,
// building roofs that open when the player walks in, and night lighting.
import { seeded, shade } from '../color';
import { drawTile } from './tiles';
import { PROPS, propDef } from './props';
import { T, type Building, type PixelMap, type Prop } from './types';

type Ctx = CanvasRenderingContext2D;

export interface Drawable {
  /** Baseline in pixels used for depth sorting. */
  base: number;
  draw: (ctx: Ctx) => void;
}

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

function paintRoof(b: Building): HTMLCanvasElement {
  const w = b.w * T;
  const h = (b.h - 2) * T;
  const [c, ctx] = canvas(w, h);
  const rnd = seeded(b.seed);
  const base = b.roof;
  const r = (x: number, y: number, ww: number, hh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  // Bitumen/plaster surface with a faint slab grid.
  r(0, 0, w, h, base);
  const seam = shade(base, -0.1);
  for (let x = 8; x < w; x += 16) r(x, 4, 1, h - 8, seam);
  for (let y = 8; y < h; y += 16) r(4, y, w - 8, 1, seam);
  for (let i = 0; i < (w * h) / 14; i++) r(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1, rnd() < 0.5 ? shade(base, -0.14) : shade(base, 0.1));
  for (let i = 0; i < (w * h) / 1400; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 8 + Math.floor(rnd() * 18), 5 + Math.floor(rnd() * 9));
  }
  // Parapet wall around the roof.
  const par = shade(base, 0.2);
  r(0, 0, w, 4, par);
  r(0, 0, 4, h, par);
  r(w - 4, 0, 4, h, shade(base, -0.05));
  r(0, h - 4, w, 4, shade(base, -0.25));
  r(4, 4, w - 8, 1, shade(base, -0.3));
  r(4, 4, 1, h - 8, shade(base, -0.3));

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
  const drop = (x: number, y: number, iw: number, ih: number) => {
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(x + 3, y + 3, iw, ih);
  };

  // Stairwell head-house with its own little roof and door.
  if (b.w * b.h > 50) {
    const pos = place(26, 22);
    if (pos) {
      const [x, y] = pos;
      drop(x, y, 26, 22);
      r(x, y, 26, 12, shade(base, 0.12));
      r(x, y, 26, 1, shade(base, 0.3));
      r(x, y + 12, 26, 10, shade(base, -0.12));
      r(x + 9, y + 13, 8, 9, '#3b2f27');
      r(x + 15, y + 17, 1, 1, '#c9a54a');
    }
  }
  // Rows of solar water heaters - the classic Tel Aviv roof.
  const heaters = Math.max(1, Math.floor((b.w * b.h) / 60));
  for (let k = 0; k < heaters; k++) {
    const n = 1 + Math.floor(rnd() * 3);
    const pos = place(n * 22, 18);
    if (!pos) continue;
    const [x0, y] = pos;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 22;
      drop(x, y, 20, 17);
      r(x, y + 6, 9, 11, '#1b2a44');
      r(x + 10, y + 6, 9, 11, '#1b2a44');
      for (let j = 0; j < 3; j++) {
        r(x + 1, y + 7 + j * 3, 7, 1, '#36547f');
        r(x + 11, y + 7 + j * 3, 7, 1, '#36547f');
      }
      r(x - 1, y, 21, 6, '#dcdad3');
      r(x - 1, y, 21, 1, '#f3f1ea');
      r(x + 19, y + 1, 1, 5, '#9a978f');
      r(x + 3, y + 5, 1, 2, '#6b6b6b');
    }
  }
  // Black water tanks.
  for (let k = 0; k < Math.floor((b.w * b.h) / 90); k++) {
    const pos = place(13, 13);
    if (!pos) continue;
    const [x, y] = pos;
    drop(x, y, 13, 13);
    r(x + 2, y, 9, 13, '#1f2328');
    r(x, y + 2, 13, 9, '#1f2328');
    r(x + 3, y + 2, 4, 2, '#3a3f47');
  }
  // AC compressors.
  for (let k = 0; k < Math.floor((b.w * b.h) / 25); k++) {
    const pos = place(11, 9);
    if (!pos) continue;
    const [x, y] = pos;
    drop(x, y, 11, 9);
    r(x, y, 11, 9, '#cfccc4');
    r(x, y, 11, 1, '#eceae4');
    r(x + 1, y + 2, 6, 6, '#7a776f');
    r(x + 2, y + 3, 4, 4, '#5f5c56');
    r(x + 8, y + 3, 2, 1, '#8a8780');
    r(x + 8, y + 5, 2, 1, '#8a8780');
  }
  // Satellite dish or antenna.
  if (rnd() < 0.7) {
    const pos = place(10, 10);
    if (pos) {
      const [x, y] = pos;
      if (rnd() < 0.5) {
        r(x + 1, y + 1, 8, 8, '#d6d3cc');
        r(x + 2, y + 2, 6, 6, '#bdb9b0');
        r(x + 4, y + 4, 2, 2, '#55524c');
      } else {
        r(x + 4, y, 2, 10, '#2b2f35');
        r(x, y + 2, 10, 1, '#2b2f35');
        r(x + 1, y + 5, 8, 1, '#2b2f35');
      }
    }
  }
  return c;
}

function lightSprite(): HTMLCanvasElement {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

const glowCache = new Map<string, HTMLCanvasElement>();
function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  const [cv, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowCache.set(color, cv);
  c = cv;
  return c;
}

export class WorldRenderer {
  readonly ground: HTMLCanvasElement;
  readonly roofs = new Map<string, HTMLCanvasElement>();
  private dark: HTMLCanvasElement;
  private darkCtx: Ctx;
  private light = lightSprite();
  private rain: { x: number; y: number; s: number }[] = [];
  readonly dynamicProps: Prop[];

  constructor(readonly map: PixelMap) {
    const [g, gctx] = canvas(map.w * T, map.h * T);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) drawTile(gctx, map, x, y);
    // Flat props: ground decals first, wall decorations after.
    const flats = map.props.filter((p) => propDef(p).flat);
    for (const p of flats.filter((p) => !propDef(p).wall)) propDef(p).draw(gctx, p.x * T, p.y * T, p, 0);
    for (const p of flats.filter((p) => propDef(p).wall)) propDef(p).draw(gctx, p.x * T, p.y * T, p, 0);
    this.ground = g;
    for (const b of map.buildings) this.roofs.set(b.id, paintRoof(b));
    this.dynamicProps = map.props.filter((p) => !PROPS[p.type]?.flat);
    [this.dark, this.darkCtx] = canvas(1, 1);
  }

  /** Building whose interior contains the tile point, if any. */
  buildingAt(x: number, y: number): Building | null {
    for (const b of this.map.buildings) {
      if (!b.enterable) continue;
      if (x >= b.x + 1 && x < b.x + b.w - 1 && y >= b.y + 1 && y < b.y + b.h - 2) return b;
    }
    return null;
  }

  render(ctx: Ctx, camX: number, camY: number, vw: number, vh: number, t: number, entities: Drawable[], openBuilding: string | null) {
    const map = this.map;
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(-Math.round(camX), -Math.round(camY));
    ctx.drawImage(this.ground, 0, 0);

    const x0 = camX - 64;
    const x1 = camX + vw + 64;
    const y0 = camY - 16;
    const y1 = camY + vh + 64;
    const list: Drawable[] = [];
    for (const p of this.dynamicProps) {
      const px = p.x * T;
      const py = p.y * T;
      if (px + p.w * T < x0 || px > x1 || py + p.h * T < y0 || py - 48 > y1) continue;
      const def = propDef(p);
      list.push({ base: (p.y + p.h) * T - 1, draw: (c) => def.draw(c, px, py, p, t) });
    }
    for (const b of map.buildings) {
      if (b.id === openBuilding) continue;
      const roof = this.roofs.get(b.id)!;
      const bx = b.x * T;
      const by = b.y * T;
      if (bx > x1 || bx + roof.width < x0 || by > y1 || by + roof.height < y0) continue;
      list.push({ base: (b.y + b.h - 2) * T - 0.5, draw: (c) => c.drawImage(roof, bx, by) });
    }
    list.push(...entities);
    list.sort((a, b) => a.base - b.base);
    for (const d of list) d.draw(ctx);
    ctx.restore();

    this.applyLighting(ctx, camX, camY, vw, vh, t, openBuilding);
    if (map.rain) this.drawRain(ctx, vw, vh, t);
  }

  private applyLighting(ctx: Ctx, camX: number, camY: number, vw: number, vh: number, t: number, openBuilding: string | null) {
    const map = this.map;
    if (this.dark.width !== vw || this.dark.height !== vh) {
      this.dark.width = vw;
      this.dark.height = vh;
    }
    const d = this.darkCtx;
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, vw, vh);
    d.fillStyle = `rgba(8,12,28,${map.darkness})`;
    d.fillRect(0, 0, vw, vh);
    d.globalCompositeOperation = 'destination-out';
    const visible = map.lights.filter((l) => {
      if (l.building && l.building !== openBuilding) return false;
      const lx = l.x * T - camX;
      const ly = l.y * T - camY;
      const rr = l.r * T;
      return lx > -rr && lx < vw + rr && ly > -rr && ly < vh + rr;
    });
    for (const l of visible) {
      const f = l.flicker ? 0.8 + 0.2 * Math.sin(t * 17 + l.x * 3) * Math.sin(t * 5.3 + l.y) : 1;
      const rr = l.r * T * 2;
      d.globalAlpha = Math.min(1, l.power * f);
      d.drawImage(this.light, l.x * T - camX - rr / 2, l.y * T - camY - rr / 2, rr, rr);
    }
    d.globalAlpha = 1;
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dark, 0, 0);
    // Colored glow on top (street lamps, neon).
    ctx.globalCompositeOperation = 'lighter';
    for (const l of visible) {
      if (l.building) continue;
      const rr = l.r * T * 1.6;
      ctx.globalAlpha = 0.16 * l.power;
      ctx.drawImage(glowSprite(l.color), l.x * T - camX - rr / 2, l.y * T - camY - rr / 2, rr, rr);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRain(ctx: Ctx, vw: number, vh: number, t: number) {
    const want = Math.floor((vw * vh) / 900);
    while (this.rain.length < want) this.rain.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.7 + Math.random() * 0.6 });
    ctx.fillStyle = 'rgba(170,190,220,0.35)';
    for (const p of this.rain) {
      p.y += 5 * p.s;
      p.x -= 1.2 * p.s;
      if (p.y > vh) {
        p.y = -6;
        p.x = Math.random() * (vw + 20);
      }
      if (p.x < 0) p.x += vw;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 4);
    }
    void t;
  }
}
