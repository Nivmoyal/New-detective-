// Style study: the same Florentin corner in an oblique (3/4) view, facades
// facing the camera. Dev only - not part of the game. ?night=1 for night.
import { drawPerson, DIR_DOWN, DIR_LEFT, DIR_RIGHT } from '../pixel/person';
import type { CharacterLook } from '../types/investigation';

const night = new URLSearchParams(location.search).get('night') === '1';
const W = 390;
const H = 760;
const c = document.getElementById('c') as HTMLCanvasElement;
const DPR = 2;
c.width = W * DPR;
c.height = H * DPR;
const g = c.getContext('2d')!;
g.scale(DPR, DPR);
// Positions below are left edges; Hebrew words still shape right-to-left.
g.direction = 'ltr';
const litWindows: [number, number][] = [];

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const rect = (x: number, y: number, w: number, h: number, fill: string | CanvasGradient) => {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
};
const rr = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = 1.2;
    g.stroke();
  }
};
const vgrad = (y0: number, y1: number, a: string, b: string) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  return gr;
};
const OUT = '#15121a';

/* ---------------- Rooftop: water heaters, antennas, tar ---------------- */
rect(0, 0, W, 96, vgrad(0, 96, '#5d5650', '#4a443f'));
for (let i = 0; i < 70; i++) rect(rnd() * W, rnd() * 90, 2 + rnd() * 6, 1, 'rgba(0,0,0,0.12)');
for (const x of [24, 92, 160, 228]) {
  // Solar water heater: panel and tank.
  g.save();
  g.translate(x, 18);
  rr(0, 14, 46, 30, 3, vgrad(14, 44, '#2c4f7c', '#1b3456'), OUT);
  g.strokeStyle = 'rgba(180,210,255,0.35)';
  g.lineWidth = 0.8;
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(k * 11.5, 15);
    g.lineTo(k * 11.5, 43);
    g.stroke();
  }
  rr(2, 0, 42, 14, 7, vgrad(0, 14, '#f1efe9', '#b9b4aa'), OUT);
  g.restore();
}
g.strokeStyle = '#2a2a2a';
g.lineWidth = 1.2;
for (const x of [310, 340]) {
  g.beginPath();
  g.moveTo(x, 70);
  g.lineTo(x, 22);
  g.moveTo(x - 10, 30);
  g.lineTo(x + 10, 30);
  g.moveTo(x - 7, 38);
  g.lineTo(x + 7, 38);
  g.stroke();
}
rect(0, 92, W, 6, '#2f2a27');

/* ---------------- Facade: three floors of the old building ---------------- */
const FY = 98;
const FH = 212;
rect(0, FY, W, FH, vgrad(FY, FY + FH, '#7b6a62', '#5a4c47'));
// Plaster texture and damp stains.
for (let i = 0; i < 160; i++) rect(rnd() * W, FY + rnd() * FH, 1 + rnd() * 3, 1 + rnd() * 2, `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},0.06)`);
for (const [x, w] of [[70, 40], [250, 60]]) rect(x, FY, w, 120, 'rgba(40,30,30,0.12)');
// Floor lines.
for (const y of [FY + 70, FY + 140]) rect(0, y - 3, W, 5, '#4a3e3a');
// Windows with shutters, balconies with plants and laundry.
const lit = (k: number) => night && (k * 7) % 3 !== 0;
let k = 0;
for (const fy of [FY + 10, FY + 80]) {
  for (const x of [18, 108, 198, 288]) {
    k++;
    rr(x, fy, 44, 46, 2, lit(k) ? vgrad(fy, fy + 46, '#ffd88a', '#f59e0b') : '#2a2f38', OUT);
    if (lit(k)) litWindows.push([x, fy]);
    // Half-open plastic shutter (trisim).
    const open = 14 + ((k * 13) % 24);
    rect(x + 1, fy + 1, 42, open, '#c9c1b2');
    for (let s = 3; s < open; s += 3) rect(x + 1, fy + s, 42, 0.8, 'rgba(0,0,0,0.18)');
    if (k % 2 === 0) {
      // Balcony rail with a plant and a towel.
      rect(x - 6, fy + 40, 56, 3, '#3a3a40');
      for (let r = 0; r < 56; r += 6) rect(x - 6 + r, fy + 43, 1.5, 14, '#3a3a40');
      rect(x - 6, fy + 56, 56, 3, '#3a3a40');
      rr(x + 30, fy + 30, 12, 12, 3, '#9a4b2b');
      g.fillStyle = '#3f7d3a';
      g.beginPath();
      g.arc(x + 36, fy + 28, 9, 0, Math.PI * 2);
      g.fill();
      rect(x + 2, fy + 42, 10, 13, k % 4 === 0 ? '#c2410c' : '#2563eb');
    } else {
      // Window AC unit.
      rr(x + 46, fy + 24, 22, 16, 2, '#d8d6d0', OUT);
      for (let s = 0; s < 4; s++) rect(x + 49, fy + 27 + s * 3, 16, 1, '#9b9a95');
    }
  }
}
// Cables drooping across the facade.
g.strokeStyle = '#111';
g.lineWidth = 1;
g.beginPath();
g.moveTo(0, FY + 60);
g.quadraticCurveTo(W / 2, FY + 92, W, FY + 52);
g.moveTo(0, FY + 66);
g.quadraticCurveTo(W / 2, FY + 100, W, FY + 60);
g.stroke();

/* ---------------- Ground floor: the club, graffiti, a shutter ---------------- */
const GY = FY + 150;
rect(0, GY, W, 62, '#2a2328');
// Graffiti wall on the left.
const tags: [number, string, number][] = [[6, '#22d3ee', 0], [48, '#f472b6', 1], [100, '#facc15', 2]];
for (const [x, col, i] of tags) {
  g.save();
  g.translate(x, GY + 34);
  g.rotate(-0.08 + i * 0.06);
  g.font = 'bold 19px Heebo, sans-serif';
  g.lineWidth = 4;
  g.strokeStyle = '#111';
  const word = ['יפו', 'דרום', 'כאן'][i];
  g.strokeText(word, 0, 0);
  g.fillStyle = col;
  g.fillText(word, 0, 0);
  g.restore();
}
// Club door.
rr(140, GY + 8, 40, 54, 2, '#0b0a0d', OUT);
rect(142, GY + 10, 36, 4, '#e11d48');
// Rolled-down shop shutter with a poster.
rr(206, GY + 6, 90, 56, 2, vgrad(GY, GY + 62, '#8d8f94', '#6b6d72'), OUT);
for (let s = 10; s < 60; s += 4) rect(207, GY + s, 88, 1, 'rgba(0,0,0,0.22)');
rr(222, GY + 14, 26, 34, 1, '#f5e6c8');
rect(225, GY + 18, 20, 3, '#b91c1c');
rect(225, GY + 24, 16, 2, '#444');
rect(225, GY + 28, 18, 2, '#444');
// Neon sign.
const sx = 140;
const sy = GY - 26;
if (night) {
  const glow = g.createRadialGradient(sx + 70, sy + 12, 4, sx + 70, sy + 12, 120);
  glow.addColorStop(0, 'rgba(244,63,94,0.55)');
  glow.addColorStop(1, 'rgba(244,63,94,0)');
  g.fillStyle = glow;
  g.fillRect(sx - 60, sy - 100, 260, 240);
}
rr(sx, sy, 140, 26, 5, '#120a10', night ? '#fb7185' : '#7f1d1d');
g.font = 'bold 17px Heebo, sans-serif';
g.textAlign = 'center';
g.fillStyle = night ? '#ffe4e6' : '#fda4af';
if (night) {
  g.shadowColor = '#f43f5e';
  g.shadowBlur = 12;
}
g.fillText('הבונקר', sx + 70, sy + 19);
g.shadowBlur = 0;
g.textAlign = 'start';

/* ---------------- Sidewalk, road, crosswalk ---------------- */
const SW = FY + FH;
rect(0, SW, W, 58, vgrad(SW, SW + 58, '#8a8580', '#77726c'));
for (let x = 0; x < W; x += 26) rect(x, SW, 1, 58, 'rgba(0,0,0,0.12)');
for (let y = SW; y < SW + 58; y += 14) rect(0, y, W, 1, 'rgba(0,0,0,0.1)');
rect(0, SW + 56, W, 6, '#cfcac2'); // curb
const RY = SW + 62;
const RH = 104;
rect(0, RY, W, RH, night ? '#1b1d24' : '#3a3d45');
for (let i = 0; i < 260; i++) rect(rnd() * W, RY + rnd() * RH, 1, 1, 'rgba(255,255,255,0.05)');
for (let x = 6; x < W; x += 52) rect(x, RY + RH / 2 - 2, 28, 4, '#e7e2d6');
for (let i = 0; i < 6; i++) rect(32 + i * 20, RY + 6, 12, RH - 12, 'rgba(240,238,230,0.92)');
rect(0, RY + RH, W, 6, '#cfcac2');
// Wet-road reflections of the neon and the lamp.
if (night) {
  g.globalCompositeOperation = 'lighter';
  for (const [x, col, w] of [[210, 'rgba(244,63,94,0.35)', 60], [326, 'rgba(253,230,138,0.3)', 34]] as const) {
    const gr = g.createLinearGradient(0, RY, 0, RY + RH);
    gr.addColorStop(0, col);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, RY + RH / 2, w / 2, RH / 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}
// Parked car, seen from the side and a little above.
const car = (x: number, y: number, body: string) => {
  rr(x, y + 10, 92, 26, 8, body, OUT);
  rr(x + 18, y, 52, 18, 6, body, OUT);
  rr(x + 22, y + 3, 20, 11, 2, night ? '#2b3446' : '#a8c0d8');
  rr(x + 46, y + 3, 20, 11, 2, night ? '#2b3446' : '#a8c0d8');
  for (const wx of [x + 18, x + 72]) {
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(wx, y + 36, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#777';
    g.beginPath();
    g.arc(wx, y + 36, 3, 0, Math.PI * 2);
    g.fill();
  }
  if (night) rect(x + 86, y + 16, 5, 5, '#fde68a');
};
car(250, RY + 10, '#e8e6df');

/* ---------------- The square: tiles, tree, bench, kiosk ---------------- */
const PY = RY + RH + 6;
rect(0, PY, W, H - PY, vgrad(PY, H, '#8f6f62', '#7a5d52'));
for (let y = PY; y < H; y += 18) for (let x = (y / 18) % 2 ? 0 : 18; x < W; x += 36) rect(x, y, 35, 17, 'rgba(255,255,255,0.04)');
// Shadows (day) cast down-right.
const shadow = (x: number, y: number, w: number, h: number) => {
  if (night) return;
  g.fillStyle = 'rgba(20,10,30,0.28)';
  g.beginPath();
  g.ellipse(x, y, w, h, 0.3, 0, Math.PI * 2);
  g.fill();
};
// Kiosk with awning.
const KX = 236;
const KY = PY + 70;
shadow(KX + 90, KY + 120, 70, 18);
rr(KX, KY + 20, 130, 96, 3, '#d9d2c3', OUT);
rr(KX + 10, KY + 44, 110, 44, 2, night ? vgrad(KY + 44, KY + 88, '#fff1c2', '#fbbf24') : '#3b4250', OUT);
for (let i = 0; i < 8; i++) rect(KX + 14 + i * 13, KY + 52, 9, 14, ['#ef4444', '#3b82f6', '#22c55e', '#eab308'][i % 4]);
g.fillStyle = '#0f766e';
g.beginPath();
g.moveTo(KX - 6, KY + 30);
g.lineTo(KX + 136, KY + 30);
g.lineTo(KX + 126, KY + 6);
g.lineTo(KX + 4, KY + 6);
g.closePath();
g.fill();
for (let i = 0; i < 7; i++) {
  g.fillStyle = i % 2 ? '#f8fafc' : '#0f766e';
  g.fillRect(KX - 6 + i * 20.3, KY + 30, 20.3, 8);
}
g.font = 'bold 13px Heebo, sans-serif';
g.textAlign = 'center';
g.fillStyle = '#f8fafc';
g.fillText('קיוסק 24/7', KX + 65, KY + 23);
g.textAlign = 'start';
// Tree.
shadow(96, PY + 196, 54, 16);
rect(70, PY + 120, 8, 72, '#5b3a24');
for (const [dx, dy, r, col] of [[-20, 96, 30, '#2f5d34'], [18, 92, 32, '#356b3a'], [0, 70, 34, '#3f7d42'], [-10, 84, 26, '#4a8f4c']] as const) {
  g.fillStyle = col;
  g.beginPath();
  g.arc(74 + dx, PY + dy, r, 0, Math.PI * 2);
  g.fill();
}
// Bench.
shadow(64, PY + 262, 46, 8);
rr(20, PY + 238, 90, 9, 2, '#7c4a2a', OUT);
rr(20, PY + 226, 90, 8, 2, '#8a5532', OUT);
rect(26, PY + 247, 4, 12, '#222');
rect(100, PY + 247, 4, 12, '#222');
// Street lamp on the far sidewalk.
rect(324, SW - 70, 4, 124, '#2b2b30');
rr(312, SW - 78, 30, 10, 4, '#2b2b30');
if (night) {
  const cone = g.createRadialGradient(326, SW + 30, 4, 326, SW + 30, 110);
  cone.addColorStop(0, 'rgba(253,230,138,0.45)');
  cone.addColorStop(1, 'rgba(253,230,138,0)');
  g.fillStyle = cone;
  g.fillRect(200, SW - 80, 260, 240);
}

/* ---------------- People, a little larger than in the game ---------------- */
const look = (body: 'male' | 'female', skin: string, hairStyle: CharacterLook['hairStyle'], hairColor: string, outfit: CharacterLook['outfit'], topColor: string, extra: Partial<CharacterLook> = {}): CharacterLook =>
  ({ body, skin, hairStyle, hairColor, outfit, topColor, pantsColor: '#22252b', ...extra }) as CharacterLook;
const people: [CharacterLook, number, number, number][] = [
  [look('male', '#c98f66', 'bald', '#16120f', 'tshirt', '#1c1c1c', { beard: true }), 112, SW + 30, DIR_DOWN],
  [look('male', '#e5b48f', 'short', '#16120f', 'leather', '#5b3a24'), 196, RY + 64, DIR_LEFT],
  [look('female', '#f3d2b3', 'long', '#3b2618', 'tshirt', '#be185d'), 300, KY + 140, DIR_LEFT],
  [look('male', '#e5b48f', 'long', '#16120f', 'hoodie', '#1e293b', { beard: true }), 150, PY + 214, DIR_RIGHT],
  [look('female', '#f3d2b3', 'curly', '#a0a0a0', 'blazer', '#4b3a2a', { glasses: true }), 190, PY + 226, DIR_DOWN],
];
for (const [lk, x, y, dir] of people) {
  shadow(x + 8, y + 2, 14, 4);
  g.save();
  g.translate(x, y);
  g.scale(2.1, 2.1);
  drawPerson(g as unknown as CanvasRenderingContext2D, lk, 0, 0, { dir: dir as 0 }, 1);
  g.restore();
}

/* ---------------- Light: day warmth or night dark, grade, vignette ---------------- */
if (night) {
  g.globalCompositeOperation = 'multiply';
  rect(0, 0, W, H, '#6a6f9e');
  g.globalCompositeOperation = 'lighter';
  for (const [x, y] of litWindows) {
    const wg = g.createRadialGradient(x + 22, y + 30, 2, x + 22, y + 30, 46);
    wg.addColorStop(0, 'rgba(255,200,110,0.4)');
    wg.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = wg;
    g.fillRect(x - 30, y - 20, 104, 100);
  }
  g.globalCompositeOperation = 'lighter';
  for (const [x, y, r, col] of [[210, GY - 14, 120, 'rgba(244,63,94,0.25)'], [326, SW - 60, 140, 'rgba(253,230,138,0.28)'], [KX + 65, KY + 66, 120, 'rgba(253,224,138,0.25)']] as const) {
    const gl = g.createRadialGradient(x, y, 2, x, y, r);
    gl.addColorStop(0, col);
    gl.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gl;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Lit windows glow out a little.
  g.globalCompositeOperation = 'source-over';
} else {
  g.globalCompositeOperation = 'soft-light';
  const warm = g.createLinearGradient(0, 0, W, H);
  warm.addColorStop(0, '#fde68a');
  warm.addColorStop(1, '#7c3aed');
  g.globalAlpha = 0.35;
  rect(0, 0, W, H, warm);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}
const v = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 520);
v.addColorStop(0, 'rgba(0,0,0,0)');
v.addColorStop(1, `rgba(0,0,0,${night ? 0.6 : 0.35})`);
rect(0, 0, W, H, v);
document.title = 'ready';
