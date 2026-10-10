// Small color + pixel buffer helpers shared by every pixel-art renderer.

export type RGB = [number, number, number];

const cache = new Map<string, RGB>();

export function rgb(hex: string): RGB {
  let c = cache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h.slice(0, 6), 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, c);
  return c;
}

export function toHex([r, g, b]: RGB): string {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** f < 0 darkens towards a cool shadow, f > 0 lightens towards warm white. */
export function shade(hex: string, f: number): string {
  const [r, g, b] = rgb(hex);
  if (f < 0) {
    const k = 1 + f;
    // Shadows drift slightly blue, which reads better at night.
    return toHex([r * k, g * k, b * k + (1 - k) * 18]);
  }
  return toHex([r + (255 - r) * f, g + (250 - g) * f, b + (235 - b) * f]);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Deterministic random generator (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A tiny RGBA pixel buffer used to paint sprites pixel by pixel. */
export class PixelBuffer {
  readonly data: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  set(x: number, y: number, color: string, alpha = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const [r, g, b] = rgb(color);
    const i = (y * this.w + x) * 4;
    if (alpha >= 255 || this.data[i + 3] === 0) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = alpha;
    } else {
      const t = alpha / 255;
      this.data[i] += (r - this.data[i]) * t;
      this.data[i + 1] += (g - this.data[i + 1]) * t;
      this.data[i + 2] += (b - this.data[i + 2]) * t;
    }
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  /** Horizontal run from x0 to x1 inclusive. */
  row(y: number, x0: number, x1: number, color: string) {
    for (let x = x0; x <= x1; x++) this.set(x, y, color);
  }

  col(x: number, y0: number, y1: number, color: string) {
    for (let y = y0; y <= y1; y++) this.set(x, y, color);
  }

  clear(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  /** Paint an outline around every opaque pixel inside the given region. */
  outline(color: string, rx = 0, ry = 0, rw = this.w, rh = this.h) {
    const marks: number[] = [];
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++) {
        if (this.alpha(x, y) !== 0) continue;
        const n =
          (x > rx && this.alpha(x - 1, y) > 0) ||
          (x < rx + rw - 1 && this.alpha(x + 1, y) > 0) ||
          (y > ry && this.alpha(x, y - 1) > 0) ||
          (y < ry + rh - 1 && this.alpha(x, y + 1) > 0);
        if (n) marks.push(x, y);
      }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], color);
  }

  /** Copy a region mirrored horizontally. */
  mirrorFrom(src: PixelBuffer, sx: number, sy: number, w: number, h: number, dx: number, dy: number) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const si = ((sy + y) * src.w + (sx + w - 1 - x)) * 4;
        const di = ((dy + y) * this.w + (dx + x)) * 4;
        for (let k = 0; k < 4; k++) this.data[di + k] = src.data[si + k];
      }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}
