import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { drawPortrait, type Expression } from '../../pixel/person';
import { FrameUpscaler } from '../../pixel/upscale';

interface Props {
  suspect: CharacterLook;
  detective: CharacterLook;
  expression: Expression;
  talking: boolean;
  detectiveTalking: boolean;
  tension: number;
  className?: string;
}

const W = 200;
const H = 96;

/** The interrogation room in pixel art: swinging lamp, one-way mirror, suspect across the table. */
export default function InterrogationScene({ suspect, detective, expression, talking, detectiveTalking, tension, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ suspect, detective, expression, talking, detectiveTalking, tension });
  live.current = { suspect, detective, expression, talking, detectiveTalking, tension };

  useEffect(() => {
    const c = ref.current!;
    const out = c.getContext('2d')!;
    const buffer = document.createElement('canvas');
    buffer.width = W;
    buffer.height = H;
    const ctx = buffer.getContext('2d', { willReadFrequently: true })!;
    const upscaler = new FrameUpscaler();
    let raf = 0;
    let mouth = false;
    let mouthAt = 0;
    let blinkAt = performance.now() + 2000;
    const r = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const tick = (now: number) => {
      const L = live.current;
      const t = now / 1000;
      if (now > mouthAt) {
        mouth = (L.talking || L.detectiveTalking) && Math.random() < 0.7 ? !mouth : false;
        mouthAt = now + 120;
      }
      const blink = now > blinkAt && now < blinkAt + 130;
      if (now > blinkAt + 130) blinkAt = now + 2500 + Math.random() * 2500;
      ctx.imageSmoothingEnabled = false;

      // Wall tiles.
      r(0, 0, W, H, '#1f2a28');
      for (let y = 0; y < 62; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < W; x += 8) r(x, y, 7, 7, '#253330');
      r(0, 60, W, 2, '#141c1b');
      // One-way mirror.
      r(118, 10, 70, 34, '#0f1418');
      r(120, 12, 66, 30, '#2a3a48');
      r(124, 15, 20, 1, '#5b7389');
      r(150, 30, 26, 1, '#41566a');
      // Camera in the corner.
      r(8, 6, 8, 4, '#c9ccd1');
      r(15, 7, 3, 2, '#111');
      if (Math.floor(t * 2) % 2) r(9, 7, 1, 1, '#ef4444');
      // Floor.
      r(0, 62, W, H - 62, '#2b2a2a');
      for (let x = 0; x < W; x += 16) r(x, 62, 1, H - 62, '#232222');

      // Smooth the pixels, then add soft light and shadow at full resolution.
      upscaler.run(ctx, W, H);
      out.drawImage(upscaler.out, 0, 0);
      const k = upscaler.factor;
      out.save();
      out.scale(k, k);
      const o = (x: number, y: number, w: number, h: number, col: string) => {
        out.fillStyle = col;
        out.fillRect(x, y, w, h);
      };
      out.imageSmoothingEnabled = true;
      out.imageSmoothingQuality = 'high';
      // Suspect, seated behind the table (smoothed high-resolution portrait).
      const shake = L.tension >= 80 ? Math.sin(t * 40) * 0.6 : 0;
      out.save();
      out.translate(46 + shake, 14);
      drawPortrait(out, L.suspect, 80, { expression: L.expression, mouthOpen: L.talking && mouth, blink });
      out.restore();
      // Table.
      o(14, 70, 150, 6, '#7b828c');
      o(14, 70, 150, 1, '#a3aab3');
      o(14, 76, 150, 20, '#555b63');
      o(60, 72, 22, 3, '#e7e2d6');
      o(62, 73, 14, 1, '#7f1d1d');
      o(110, 71, 6, 4, '#111827');
      // Detective, seen from behind in the foreground.
      out.save();
      out.translate(140, 26);
      drawPortrait(out, L.detective, 80, { back: true });
      out.restore();
      // Swinging lamp.
      const swing = Math.sin(t * 1.3) * 6;
      const lx = 86 + swing;
      o(86, 0, 1, 10, '#111');
      o(lx - 8, 10, 16, 5, '#3f4650');
      o(lx - 3, 15, 6, 2, '#fde68a');
      const g2 = out.createRadialGradient(lx, 16, 2, lx, 70, 70);
      g2.addColorStop(0, 'rgba(255,236,170,0.32)');
      g2.addColorStop(1, 'rgba(255,236,170,0)');
      out.fillStyle = g2;
      out.beginPath();
      out.moveTo(lx - 6, 16);
      out.lineTo(lx + 6, 16);
      out.lineTo(lx + 70, H);
      out.lineTo(lx - 70, H);
      out.closePath();
      out.fill();
      // Darkness at the edges.
      const v = out.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 120);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.55 + L.tension / 400})`);
      out.fillStyle = v;
      out.fillRect(0, 0, W, H);
      out.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={W * 4}
      height={H * 4}
      className={className}
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  );
}
