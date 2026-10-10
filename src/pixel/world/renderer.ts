// Draws a PixelMap: cached ground layer, y-sorted props and characters,
// building roofs that open when the player walks in, and night lighting.

import { drawGroundOverlay, drawRoofHD, drawTileHD, VECTOR_PROPS, type VectorDraw } from './smooth';
import { PROPS, propDef } from './props';
import { upscaleCanvas } from '../upscale';
import { hashString } from '../color';
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

/** Internal resolution of the painted ground and roofs (device pixels per world pixel). */
const K = 3;
/** Vector props are painted at this many pixels per world pixel. */
const PROP_K = 4;

const PAD_X = 16;
const PAD_TOP = 48;
const PAD_BOTTOM = 8;

/** Animated props are cached per frame of their animation. */
function animFrame(type: string, t: number): [number, number] {
  switch (type) {
    case 'policeCar': {
      const f = Math.floor(t * 3) % 2;
      return [f, f / 3 + 0.05];
    }
    case 'djBooth': {
      const f = Math.floor(t * 6) % 3;
      return [f, f / 6 + 0.01];
    }
    case 'cctvBox': {
      const f = Math.floor(t) % 4;
      return [f, f + 0.1];
    }
    case 'cat': {
      const f = Math.floor(t * 4) % 8;
      return [f, f / 4];
    }
    default:
      return [0, 0];
  }
}

export class WorldRenderer {
  /** Ground painted with vector shapes at K pixels per world pixel. */
  private groundHD: HTMLCanvasElement;
  readonly roofs = new Map<string, HTMLCanvasElement>();
  /** Cached prop images and how many image pixels make one world pixel. */
  private propCache = new Map<string, { c: HTMLCanvasElement; f: number }>();
  private dark: HTMLCanvasElement;
  private darkCtx: Ctx;
  private light = lightSprite();
  private rain: { x: number; y: number; s: number }[] = [];
  readonly dynamicProps: Prop[];

  constructor(readonly map: PixelMap) {
    const [g, gctx] = canvas(map.w * T * K, map.h * T * K);
    gctx.imageSmoothingEnabled = true;
    gctx.imageSmoothingQuality = 'high';
    gctx.scale(K, K);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) drawTileHD(gctx, map, x, y);
    drawGroundOverlay(gctx, map);
    // Flat props: ground decals first, wall decorations after. Each is
    // edge-smoothed on its own and laid onto the painted ground.
    const flats = map.props.filter((p) => propDef(p).flat);
    for (const p of [...flats.filter((p) => !propDef(p).wall), ...flats.filter((p) => propDef(p).wall)]) {
      const pad = 4;
      const [raw, rctx] = canvas(p.w * T + pad * 2, p.h * T + pad * 2);
      propDef(p).draw(rctx, pad, pad, p, 0);
      gctx.drawImage(upscaleCanvas(raw, 2), p.x * T - pad, p.y * T - pad, raw.width, raw.height);
    }
    this.groundHD = g;
    for (const b of map.buildings) {
      const [rc, rctx] = canvas(b.w * T * K, (b.h - 2) * T * K);
      rctx.imageSmoothingEnabled = true;
      rctx.scale(K, K);
      drawRoofHD(rctx, b);
      this.roofs.set(b.id, rc);
    }
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

  private propImage(p: Prop, t: number): { c: HTMLCanvasElement; f: number } {
    const [f, tf] = animFrame(p.type, t);
    const vector = VECTOR_PROPS[p.type] as VectorDraw | undefined;
    // Vector props with their own shape (trees, plants, palms) are cached per prop.
    const own = vector && (p.type === 'tree' || p.type === 'lemonTree' || p.type === 'palm' || p.type === 'plant');
    const key = `${p.type}|${p.w}|${p.h}|${p.color ?? hashString(p.id) % 9}|${p.variant ?? ''}|${f}${own ? `|${p.id}` : ''}`;
    let img = this.propCache.get(key);
    if (!img) {
      const w = p.w * T + PAD_X * 2;
      const h = p.h * T + PAD_TOP + PAD_BOTTOM;
      if (vector) {
        const [c, ctx] = canvas(w * PROP_K, h * PROP_K);
        ctx.imageSmoothingEnabled = true;
        ctx.scale(PROP_K, PROP_K);
        vector(ctx, PAD_X, PAD_TOP, p, tf);
        img = { c, f: PROP_K };
      } else {
        const [raw, rctx] = canvas(w, h);
        propDef(p).draw(rctx, PAD_X, PAD_TOP, p, tf);
        img = { c: upscaleCanvas(raw, 2), f: 4 };
      }
      this.propCache.set(key, img);
    }
    return img;
  }

  /**
   * Draw the world straight onto the screen canvas. Units are world pixels;
   * S is screen pixels per world pixel, so people and text stay sharp.
   */
  render(ctx: Ctx, camX: number, camY: number, S: number, vw: number, vh: number, t: number, entities: Drawable[], openBuilding: string | null) {
    const map = this.map;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0, 0, vw * S, vh * S);
    ctx.setTransform(S, 0, 0, S, -camX * S, -camY * S);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Visible part of the ground.
    const gx = Math.max(0, Math.floor(camX));
    const gy = Math.max(0, Math.floor(camY));
    const gw = Math.min(map.w * T - gx, Math.ceil(vw) + 2);
    const gh = Math.min(map.h * T - gy, Math.ceil(vh) + 2);
    if (gw > 0 && gh > 0) ctx.drawImage(this.groundHD, gx * K, gy * K, gw * K, gh * K, gx, gy, gw, gh);

    const x0 = camX - 64;
    const x1 = camX + vw + 64;
    const y0 = camY - 16;
    const y1 = camY + vh + 64;
    const list: Drawable[] = [];
    for (const p of this.dynamicProps) {
      const px = p.x * T;
      const py = p.y * T;
      if (px + p.w * T < x0 || px > x1 || py + p.h * T < y0 || py - 48 > y1) continue;
      list.push({
        base: (p.y + p.h) * T - 1,
        draw: (c) => {
          const { c: img, f } = this.propImage(p, t);
          c.drawImage(img, px - PAD_X, py - PAD_TOP, img.width / f, img.height / f);
        },
      });
    }
    for (const b of map.buildings) {
      if (b.id === openBuilding) continue;
      const roof = this.roofs.get(b.id)!;
      const bx = b.x * T;
      const by = b.y * T;
      const rw = roof.width / K;
      const rh = roof.height / K;
      if (bx > x1 || bx + rw < x0 || by > y1 || by + rh < y0) continue;
      list.push({ base: (b.y + b.h - 2) * T - 0.5, draw: (c) => c.drawImage(roof, bx, by, rw, rh) });
    }
    list.push(...entities);
    list.sort((a, b) => a.base - b.base);
    for (const d of list) d.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Night lighting and rain, drawn on top of the (possibly upscaled) frame. k = upscale factor. */
  renderEffects(ctx: Ctx, camX: number, camY: number, vw: number, vh: number, t: number, openBuilding: string | null, k = 1) {
    this.applyLighting(ctx, camX * k, camY * k, vw * k, vh * k, t, openBuilding, T * k);
    if (this.map.rain) this.drawRain(ctx, vw * k, vh * k, k);
  }

  private applyLighting(ctx: Ctx, camX: number, camY: number, vw: number, vh: number, t: number, openBuilding: string | null, TS: number) {
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
      const lx = l.x * TS - camX;
      const ly = l.y * TS - camY;
      const rr = l.r * TS;
      return lx > -rr && lx < vw + rr && ly > -rr && ly < vh + rr;
    });
    for (const l of visible) {
      const f = l.flicker ? 0.8 + 0.2 * Math.sin(t * 17 + l.x * 3) * Math.sin(t * 5.3 + l.y) : 1;
      const rr = l.r * TS * 2;
      d.globalAlpha = Math.min(1, l.power * f);
      d.drawImage(this.light, l.x * TS - camX - rr / 2, l.y * TS - camY - rr / 2, rr, rr);
    }
    d.globalAlpha = 1;
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dark, 0, 0);
    // Colored glow on top (street lamps, neon).
    ctx.globalCompositeOperation = 'lighter';
    for (const l of visible) {
      if (l.building) continue;
      const rr = l.r * TS * 1.6;
      ctx.globalAlpha = 0.16 * l.power;
      ctx.drawImage(glowSprite(l.color), l.x * TS - camX - rr / 2, l.y * TS - camY - rr / 2, rr, rr);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRain(ctx: Ctx, vw: number, vh: number, k: number) {
    const want = Math.floor((vw * vh) / (900 * k * k));
    while (this.rain.length < want) this.rain.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.7 + Math.random() * 0.6 });
    if (this.rain.length > want) this.rain.length = want;
    ctx.fillStyle = 'rgba(170,190,220,0.32)';
    const w = Math.max(1, Math.round(k / 2));
    for (const p of this.rain) {
      p.y += 5 * p.s * k;
      p.x -= 1.2 * p.s * k;
      if (p.y > vh) {
        p.y = -6 * k;
        p.x = Math.random() * (vw + 20 * k);
      }
      if (p.x < 0) p.x += vw;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), w, 4 * k);
    }
  }
}
