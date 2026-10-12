import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { drawPortrait, type Expression } from '../../pixel/person';
import { ambient } from '../../pixel/audio';

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

/** The interrogation room, painted smooth: swinging lamp, one-way mirror, suspect across the table. */
export default function InterrogationScene({ suspect, detective, expression, talking, detectiveTalking, tension, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ suspect, detective, expression, talking, detectiveTalking, tension });
  live.current = { suspect, detective, expression, talking, detectiveTalking, tension };

  // The room has its own score; the station's returns on the way out.
  useEffect(() => {
    ambient.unlock();
    ambient.setMusic('interrogation');
    return () => ambient.setMusic('station');
  }, []);

  useEffect(() => {
    const c = ref.current!;
    const out = c.getContext('2d')!;
    const K = c.width / W;
    let raf = 0;
    let mouth = false;
    let mouthAt = 0;
    let blinkAt = performance.now() + 2000;
    const rr = (x: number, y: number, w: number, h: number, rad: number, fill: string | CanvasGradient) => {
      out.beginPath();
      out.roundRect(x, y, w, h, rad);
      out.fillStyle = fill;
      out.fill();
    };
    const vg = (y0: number, y1: number, a: string, b: string) => {
      const g = out.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      return g;
    };
    // The room itself never changes: paint it once, smooth, at full resolution.
    const room = document.createElement('canvas');
    room.width = c.width;
    room.height = c.height;
    {
      const r = room.getContext('2d')!;
      r.scale(K, K);
      const box = (x: number, y: number, w: number, h: number, rad: number, fill: string | CanvasGradient) => {
        r.beginPath();
        r.roundRect(x, y, w, h, rad);
        r.fillStyle = fill;
        r.fill();
      };
      const lg = (y0: number, y1: number, a: string, b: string) => {
        const g = r.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        return g;
      };
      // Tiled wall, a little grimy towards the floor.
      r.fillStyle = '#18211f';
      r.fillRect(0, 0, W, 62);
      for (let y = 0; y < 62; y += 8)
        for (let x = (y / 8) % 2 ? -4 : 0; x < W; x += 8) box(x + 0.4, y + 0.4, 7.2, 7.2, 0.8, lg(y, y + 8, '#2c3b37', '#22302d'));
      r.fillStyle = lg(40, 62, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.35)');
      r.fillRect(0, 40, W, 22);
      // Skirting and floor.
      box(0, 59.5, W, 3, 0, lg(59.5, 62.5, '#3a3f3d', '#141918'));
      r.fillStyle = lg(62, H, '#2f2d2b', '#1b1a19');
      r.fillRect(0, 62, W, H - 62);
      r.strokeStyle = 'rgba(0,0,0,0.25)';
      r.lineWidth = 0.4;
      for (let x = -40; x < W + 40; x += 18) {
        r.beginPath();
        r.moveTo(W / 2 + (x - W / 2) * 0.55, 62);
        r.lineTo(x, H);
        r.stroke();
      }
      // One-way mirror: dark glass, a frame, faint reflections.
      box(116, 8, 74, 38, 1.5, lg(8, 46, '#4b5258', '#2a2f33'));
      const glass = r.createLinearGradient(118, 10, 188, 44);
      glass.addColorStop(0, '#2b3d4d');
      glass.addColorStop(0.5, '#16212b');
      glass.addColorStop(1, '#0d141a');
      box(118.5, 10.5, 69, 33, 1, glass);
      r.strokeStyle = 'rgba(190,215,235,0.16)';
      r.lineWidth = 1.2;
      for (const [x0, w] of [[126, 18], [146, 10], [168, 14]]) {
        r.beginPath();
        r.moveTo(x0, 42);
        r.lineTo(x0 + w, 12);
        r.stroke();
      }
      // Wall clock that stopped at ten past two.
      r.beginPath();
      r.arc(28, 20, 7, 0, Math.PI * 2);
      r.fillStyle = '#d9d6cc';
      r.fill();
      r.lineWidth = 1;
      r.strokeStyle = '#3a3a3a';
      r.stroke();
      r.lineWidth = 0.7;
      r.beginPath();
      r.moveTo(28, 20);
      r.lineTo(28, 15.5);
      r.moveTo(28, 20);
      r.lineTo(31.5, 18.8);
      r.stroke();
      // Camera bracket in the corner.
      box(4, 5, 2, 6, 0.5, '#9aa0a8');
      box(5, 6, 11, 5, 1.5, lg(6, 11, '#d7dbe0', '#9ea4ab'));
      box(15, 7, 3, 3, 1, '#1b1f24');
    }

    const tick = (now: number) => {
      const L = live.current;
      const t = now / 1000;
      if (now > mouthAt) {
        mouth = (L.talking || L.detectiveTalking) && Math.random() < 0.7 ? !mouth : false;
        mouthAt = now + 120;
      }
      const blink = now > blinkAt && now < blinkAt + 130;
      if (now > blinkAt + 130) blinkAt = now + 2500 + Math.random() * 2500;

      out.setTransform(1, 0, 0, 1, 0, 0);
      out.drawImage(room, 0, 0);
      out.save();
      out.scale(K, K);
      out.imageSmoothingEnabled = true;
      out.imageSmoothingQuality = 'high';
      // The camera's light blinks.
      if (Math.floor(t * 2) % 2) {
        out.beginPath();
        out.arc(7.5, 8.5, 0.8, 0, Math.PI * 2);
        out.fillStyle = '#ef4444';
        out.fill();
      }
      // Suspect, seated behind the table.
      const shake = L.tension >= 80 ? Math.sin(t * 40) * 0.6 : 0;
      out.save();
      out.translate(46 + shake, 14);
      drawPortrait(out, L.suspect, 80, { expression: L.expression, mouthOpen: L.talking && mouth, blink });
      out.restore();
      // Table between them: a top in light, a front in shade, a case folder and a cup.
      rr(12, 69, 154, 7, 2, vg(69, 76, '#a3aab3', '#6f767f'));
      rr(14, 75.5, 150, 21, 1, vg(75.5, 96, '#4e545c', '#2b2f34'));
      rr(58, 70.4, 26, 4, 0.6, vg(70, 74, '#efe9dc', '#d3ccbc'));
      rr(60, 71.6, 15, 0.8, 0.3, '#8f1d1d');
      out.beginPath();
      out.ellipse(113, 72, 3.2, 1.3, 0, 0, Math.PI * 2);
      out.fillStyle = '#e8e4da';
      out.fill();
      out.beginPath();
      out.ellipse(113, 72, 2.4, 0.9, 0, 0, Math.PI * 2);
      out.fillStyle = '#3b2416';
      out.fill();
      // Detective, seen from behind in the foreground.
      out.save();
      out.translate(140, 26);
      drawPortrait(out, L.detective, 80, { back: true });
      out.restore();
      // Swinging lamp on its cord.
      const swing = Math.sin(t * 1.3) * 6;
      const lx = 86 + swing;
      out.strokeStyle = '#0d0f12';
      out.lineWidth = 0.7;
      out.beginPath();
      out.moveTo(86, 0);
      out.lineTo(lx, 10);
      out.stroke();
      out.beginPath();
      out.moveTo(lx - 9, 15.5);
      out.quadraticCurveTo(lx, 7, lx + 9, 15.5);
      out.closePath();
      out.fillStyle = vg(8, 16, '#59616c', '#2c3138');
      out.fill();
      out.beginPath();
      out.ellipse(lx, 15.6, 3.2, 1.2, 0, 0, Math.PI * 2);
      out.fillStyle = '#fff1bf';
      out.fill();
      const cone = out.createLinearGradient(0, 16, 0, H);
      cone.addColorStop(0, 'rgba(255,236,170,0.34)');
      cone.addColorStop(1, 'rgba(255,236,170,0)');
      out.fillStyle = cone;
      out.beginPath();
      out.moveTo(lx - 6, 16);
      out.lineTo(lx + 6, 16);
      out.lineTo(lx + 70, H);
      out.lineTo(lx - 70, H);
      out.closePath();
      out.fill();
      // Darkness at the edges deepens with the tension.
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
