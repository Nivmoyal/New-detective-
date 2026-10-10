import { useEffect, useRef } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { FRAME_H, FRAME_W, characterSheetHD, type Dir } from '../../pixel/sprites';

interface Props {
  look: CharacterLook;
  walking?: boolean;
  scale: number;
  /** Fixed direction; rotates through all four when omitted. */
  dir?: Dir;
}

/** Large animated preview of the walking sprite (character creator). */
export default function SpritePreview({ look, walking = true, scale, dir }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lookRef = useRef(look);
  lookRef.current = look;

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const order: Dir[] = [0, 1, 3, 2];
    const tick = (now: number) => {
      const t = now / 1000;
      const d = dir ?? order[Math.floor(t / 1.6) % 4];
      const frame = walking ? Math.floor(t * 7) % 4 : 0;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(4 * scale, (FRAME_H - 2) * scale, (FRAME_W - 8) * scale, 2 * scale);
      ctx.drawImage(characterSheetHD(lookRef.current), frame * FRAME_W * 4, d * FRAME_H * 4, FRAME_W * 4, FRAME_H * 4, 0, 0, FRAME_W * scale, FRAME_H * scale);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [walking, scale, dir]);

  return <canvas ref={ref} width={FRAME_W * scale} height={FRAME_H * scale} />;
}
