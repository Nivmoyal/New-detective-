import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { drawPerson, type Dir } from '../../pixel/person';

interface Props {
  look: CharacterLook;
  walking?: boolean;
  /** CSS pixels per world pixel. */
  scale: number;
  /** Fixed direction; turns through all four when omitted. */
  dir?: Dir;
}

const W = 26;
const H = 36;

/** Large animated preview of the character (character creator). */
export default function SpritePreview({ look, walking = true, scale, dir }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;
  const dpr = typeof window === 'undefined' ? 1 : Math.min(3, window.devicePixelRatio || 1);

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const order: Dir[] = [0, 1, 3, 2];
    const tick = (now: number) => {
      const t = now / 1000;
      const d = dir ?? order[Math.floor(t / 1.8) % 4];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      drawPerson(ctx, lookRef.current, W / 2, H - 1.5, { dir: d, moving: walking, phase: t * 7 }, 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [walking, scale, dir, dpr]);

  return <canvas ref={ref} width={W * scale * dpr} height={H * scale * dpr} style={{ width: W * scale, height: H * scale }} />;
}
