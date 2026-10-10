import { useEffect, useRef, useState } from 'react';
import type { CharacterLook } from '../../types/investigation';
import { PORTRAIT_SIZE, portraitCanvasHD, type Expression } from '../../pixel/portrait';

const HD = PORTRAIT_SIZE * 4;

interface Props {
  look: CharacterLook;
  expression?: Expression;
  talking?: boolean;
  back?: boolean;
  /** Rendered size in CSS pixels (square). */
  size: number;
  className?: string;
}

/** Animated pixel portrait: blinks, and moves its mouth while talking. */
export default function PixelPortrait({ look, expression = 'neutral', talking = false, back = false, size, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(false);

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
    ctx.clearRect(0, 0, HD, HD);
    ctx.drawImage(portraitCanvasHD(look, { expression, mouthOpen: mouth, blink, back }), 0, 0);
  }, [look, expression, mouth, blink, back]);

  return (
    <canvas
      ref={ref}
      width={HD}
      height={HD}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
