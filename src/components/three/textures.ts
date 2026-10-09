import * as THREE from 'three';

// Procedurally painted canvas textures, so the game ships without image assets.

const cache = new Map<string, THREE.CanvasTexture>();

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, r: () => number, size: number) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, rand(key.length * 7919 + 13), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, r: () => number, size: number, count: number, colors: string[], max = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = 1 + r() * max;
    ctx.fillRect(r() * size, r() * size, s, s);
  }
}

export const textures = {
  asphalt: () =>
    make('asphalt', 256, (ctx, r, s) => {
      ctx.fillStyle = '#3d4046';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 5200, ['#474a51', '#33363b', '#52555c', '#2b2d31'], 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let x = r() * s;
        let y = r() * s;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (r() - 0.5) * 40;
          y += (r() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // faded lane marking
      ctx.fillStyle = 'rgba(230,226,210,0.22)';
      ctx.fillRect(s * 0.1, s / 2 - 3, s * 0.4, 6);
    }),
  sidewalk: () =>
    make('sidewalk', 256, (ctx, r, s) => {
      ctx.fillStyle = '#5b5852';
      ctx.fillRect(0, 0, s, s);
      const n = 4;
      const t = s / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const v = 80 + Math.floor(r() * 20);
          ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
          ctx.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
        }
      noise(ctx, r, s, 2500, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.06)'], 2);
    }),
  lino: () =>
    make('lino', 256, (ctx, r, s) => {
      ctx.fillStyle = '#8d939b';
      ctx.fillRect(0, 0, s, s);
      const t = s / 2;
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#959ba3' : '#868c94';
          ctx.fillRect(i * t, j * t, t, t);
        }
      noise(ctx, r, s, 3000, ['rgba(40,45,52,0.35)', 'rgba(255,255,255,0.12)'], 1.5);
      ctx.strokeStyle = 'rgba(30,34,40,0.6)';
      ctx.strokeRect(0.5, 0.5, s - 1, s - 1);
    }),
  carpet: () =>
    make('carpet', 256, (ctx, r, s) => {
      ctx.fillStyle = '#3c4a60';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 9000, ['#435270', '#34415a', '#4a5978', '#2e3a50'], 1.5);
    }),
  grass: () =>
    make('grass', 256, (ctx, r, s) => {
      ctx.fillStyle = '#26381f';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 9000, ['#2f4626', '#1f3019', '#3a5530', '#25351e'], 2.5);
    }),
  plaster: () =>
    make('plaster', 256, (ctx, r, s) => {
      ctx.fillStyle = '#bdb7ad';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 6000, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)', 'rgba(90,80,60,0.12)'], 3);
      ctx.fillStyle = 'rgba(40,30,20,0.18)';
      for (let i = 0; i < 6; i++) ctx.fillRect(r() * s, s * 0.7 + r() * s * 0.3, 2 + r() * 3, 20 + r() * 40);
    }),
  wood: () =>
    make('wood', 256, (ctx, r, s) => {
      ctx.fillStyle = '#5a3d26';
      ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 2) {
        ctx.fillStyle = `rgba(${30 + r() * 30},${18 + r() * 15},8,${0.15 + r() * 0.2})`;
        ctx.fillRect(0, y, s, 1 + r() * 2);
      }
    }),
  concrete: () =>
    make('concrete', 256, (ctx, r, s) => {
      ctx.fillStyle = '#4a4c50';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 7000, ['#55575c', '#404246', '#5d6065', '#3a3c40'], 2.5);
      ctx.fillStyle = 'rgba(20,20,22,0.25)';
      ctx.fillRect(0, s - 3, s, 3);
    }),
  awning: (a: string, b: string) =>
    make(`awning-${a}-${b}`, 128, (ctx, _r, s) => {
      const n = 8;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? a : b;
        ctx.fillRect((i * s) / n, 0, s / n, s);
      }
    }),
  corkPapers: () =>
    make('cork', 256, (ctx, r, s) => {
      ctx.fillStyle = '#8a6239';
      ctx.fillRect(0, 0, s, s);
      noise(ctx, r, s, 5000, ['#7a5530', '#9a7045', '#6b4a2a'], 2);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = r() > 0.3 ? '#efe9dc' : '#f5e17a';
        const x = 10 + r() * (s - 70);
        const y = 10 + r() * (s - 80);
        ctx.fillRect(x, y, 40 + r() * 20, 50 + r() * 20);
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(x + 20, y + 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(r() * s, r() * s);
        ctx.lineTo(r() * s, r() * s);
        ctx.stroke();
      }
    }),
  screen: () =>
    make('screen', 64, (ctx, r, s) => {
      ctx.fillStyle = '#0b2540';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#4fa3ff';
      for (let y = 6; y < s - 4; y += 6) ctx.fillRect(5, y, 10 + r() * (s - 20), 2);
    }),
};
