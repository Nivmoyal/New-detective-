import { useEffect, useRef, useState } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { drawPortrait, type Expression } from '../../pixel/person';

interface Props {
  look: CharacterLook;
  expression?: Expression;
  talking?: boolean;
  back?: boolean;
  /** Rendered size in CSS pixels (square). */
  size: number;
  className?: string;
}

/** Animated close-up: blinks, and moves its mouth while talking. */
export default function PixelPortrait({ look, expression = 'neutral', talking = false, back = false, size, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(false);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(size * dpr);

  useEffect(() => {
    let timer = 0;
    const loop = () => {
      setBlink(true);
      timer = window.setTimeout(() => {
        setBlink(false);
        timer = window.setTimeout(loop, 2400 + Math.random() * 2600);
      }, 130);
    };
    timer = window.setTimeout(loop, 1500 + Math.random() * 2000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!talking) {
      setMouth(false);
      return;
    }
    const id = window.setInterval(() => setMouth((m) => (Math.random() < 0.7 ? !m : m)), 120);
    return () => window.clearInterval(id);
  }, [talking]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, px, px);
    drawPortrait(ctx, look, px, { expression, mouthOpen: mouth, blink, back });
  }, [look, expression, mouth, blink, back, px]);

  return <canvas ref={ref} width={px} height={px} className={className} style={{ width: size, height: size }} />;
}
