import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { portraitCanvas, type Expression } from '../../pixel/portrait';

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
    const ctx = c.getContext('2d')!;
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

      // Suspect, seated behind the table.
      const shake = L.tension >= 80 ? Math.round(Math.sin(t * 40) * 0.6) : 0;
      ctx.drawImage(portraitCanvas(L.suspect, { expression: L.expression, mouthOpen: L.talking && mouth, blink }), 46 + shake, 14, 80, 80);
      // Table.
      r(14, 70, 150, 6, '#7b828c');
      r(14, 70, 150, 1, '#a3aab3');
      r(14, 76, 150, 20, '#555b63');
      r(60, 72, 22, 3, '#e7e2d6');
      r(62, 73, 14, 1, '#7f1d1d');
      r(110, 71, 6, 4, '#111827');
      // Detective, seen from behind in the foreground.
      ctx.drawImage(portraitCanvas(L.detective, { back: true }), 140, 26, 80, 80);

      // Swinging lamp and its cone of light.
      const swing = Math.sin(t * 1.3) * 6;
      const lx = 86 + swing;
      r(86, 0, 1, 10, '#111');
      r(lx - 8, 10, 16, 5, '#3f4650');
      r(lx - 3, 15, 6, 2, '#fde68a');
      const g = ctx.createRadialGradient(lx, 16, 2, lx, 70, 70);
      g.addColorStop(0, 'rgba(255,236,170,0.32)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx - 6, 16);
      ctx.lineTo(lx + 6, 16);
      ctx.lineTo(lx + 70, H);
      ctx.lineTo(lx - 70, H);
      ctx.closePath();
      ctx.fill();
      // Darkness at the edges.
      const v = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 120);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.55 + L.tension / 400})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={className}
      style={{ imageRendering: 'pixelated', objectFit: 'cover', width: '100%', height: '100%' }}
    />
  );
}
