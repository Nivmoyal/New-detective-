import { drawPerson, drawPortrait, type Dir } from '../pixel/person';
import { COMMANDER, LAB_TECH, MENTOR, EVIDENCE_CLERK, INTERROGATION_OFFICER, PATROL_DRIVER, defaultPlayerLook } from '../data/characters';
import type { CharacterLook } from '../types/investigation';

const HAIRS = ['short', 'buzz', 'long', 'ponytail', 'curly', 'bun', 'bald'] as const;
const grid = new URLSearchParams(location.search).get('grid');
const bodyLooks = (body: 'male' | 'female', beard: boolean): CharacterLook[] => HAIRS.map((h) => ({ ...defaultPlayerLook(body), hairStyle: h, beard }));
const looks: CharacterLook[] = grid === 'm' ? bodyLooks('male', false) : grid === 'b' ? bodyLooks('male', true) : grid === 'f' ? bodyLooks('female', false) : [
  defaultPlayerLook('male'),
  defaultPlayerLook('female'),
  { ...defaultPlayerLook('male'), outfit: 'suit', glasses: true, beard: true, topColor: '#1f2a3a' },
  { ...defaultPlayerLook('female'), outfit: 'blazer', hairStyle: 'ponytail', glasses: true },
  { ...defaultPlayerLook('male'), outfit: 'hoodie', hairStyle: 'curly', topColor: '#5e1f26' },
  COMMANDER.look, MENTOR.look, LAB_TECH.look, EVIDENCE_CLERK.look, INTERROGATION_OFFICER.look, PATROL_DRIVER.look,
  { ...defaultPlayerLook('female'), outfit: 'apron', hairStyle: 'bun', topColor: '#a3472b' },
];
const params = new URLSearchParams(location.search);
const S = Number(params.get('s') ?? 4);
const phase = Number(params.get('p') ?? 0);
const c = document.getElementById('c') as HTMLCanvasElement;
const colW = 30 * S;
c.width = looks.length * colW;
c.height = 4 * 34 * S + 160;
const ctx = c.getContext('2d')!;
looks.forEach((look, i) => {
  const dirs: Dir[] = [0, 1, 2, 3];
  dirs.forEach((d, j) => {
    ctx.save();
    ctx.scale(S, S);
    drawPerson(ctx, look, i * 30 + 15, j * 34 + 32, { dir: d, phase, moving: phase !== 0 });
    ctx.restore();
  });
  ctx.save();
  ctx.translate(i * colW + 4, 4 * 34 * S + 10);
  ctx.fillStyle = '#141b26';
  ctx.fillRect(0, 0, 140, 140);
  drawPortrait(ctx, look, 140, { expression: (['neutral', 'tense', 'defiant', 'broken'] as const)[i % 4] });
  ctx.restore();
});
