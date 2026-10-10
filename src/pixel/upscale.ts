// Edge-smoothing upscaler for pixel art (EPX / Scale2x). Diagonal edges become
// smooth slopes instead of stairs, while flat areas and outlines stay sharp.

/** One Scale2x pass from src (w x h) into dst (2w x 2h). */
export function scale2x(src: Uint32Array, w: number, h: number, dst: Uint32Array) {
  const W = w * 2;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = y > 0 ? row - w : row;
    const down = y < h - 1 ? row + w : row;
    let o = y * 2 * W;
    for (let x = 0; x < w; x++, o += 2) {
      const P = src[row + x];
      const A = src[up + x];
      const D = src[down + x];
      const C = x > 0 ? src[row + x - 1] : P;
      const B = x < w - 1 ? src[row + x + 1] : P;
      if (A !== D && C !== B) {
        dst[o] = C === A ? A : P;
        dst[o + 1] = A === B ? B : P;
        dst[o + W] = C === D ? C : P;
        dst[o + W + 1] = B === D ? D : P;
      } else {
        dst[o] = P;
        dst[o + 1] = P;
        dst[o + W] = P;
        dst[o + W + 1] = P;
      }
    }
  }
}

/** Reusable upscaler for a canvas that is redrawn every frame. */
export class FrameUpscaler {
  readonly out: HTMLCanvasElement;
  private outCtx: CanvasRenderingContext2D;
  private bufs: Uint32Array[] = [];
  private image: ImageData | null = null;
  private w = 0;
  private h = 0;
  passes = 2;

  constructor() {
    this.out = document.createElement('canvas');
    this.outCtx = this.out.getContext('2d')!;
  }

  get factor() {
    return 1 << this.passes;
  }

  /** Upscale the given canvas; returns the context of the result for further drawing. */
  run(src: CanvasRenderingContext2D, w: number, h: number): CanvasRenderingContext2D {
    const f = this.factor;
    if (w !== this.w || h !== this.h || this.out.width !== w * f) {
      this.w = w;
      this.h = h;
      this.out.width = w * f;
      this.out.height = h * f;
      this.bufs = [];
      for (let i = 1; i < this.passes; i++) this.bufs.push(new Uint32Array(w * h * (1 << (2 * i))));
      this.image = this.outCtx.createImageData(w * f, h * f);
    }
    let cur = new Uint32Array(src.getImageData(0, 0, w, h).data.buffer);
    let cw = w;
    let ch = h;
    for (let i = 0; i < this.passes; i++) {
      const last = i === this.passes - 1;
      const dst = last ? new Uint32Array(this.image!.data.buffer) : this.bufs[i];
      scale2x(cur, cw, ch, dst);
      cur = dst;
      cw *= 2;
      ch *= 2;
    }
    this.outCtx.putImageData(this.image!, 0, 0);
    return this.outCtx;
  }
}

/** Upscale a static canvas once (portraits, sprite sheets). */
export function upscaleCanvas(src: HTMLCanvasElement, passes = 2): HTMLCanvasElement {
  let w = src.width;
  let h = src.height;
  let cur = new Uint32Array(src.getContext('2d')!.getImageData(0, 0, w, h).data.buffer);
  for (let i = 0; i < passes; i++) {
    const dst = new Uint32Array(w * h * 4);
    scale2x(cur, w, h, dst);
    cur = dst;
    w *= 2;
    h *= 2;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  new Uint32Array(img.data.buffer).set(cur);
  ctx.putImageData(img, 0, 0);
  return out;
}
