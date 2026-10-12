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
