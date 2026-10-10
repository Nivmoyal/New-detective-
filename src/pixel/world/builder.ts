// Small DSL for laying out large pixel maps in code.
import type { CharacterLook, FacilityAction } from '../../types/investigation';
import { hashString, seeded } from '../color';
import type { Dir } from '../sprites';
import { PROPS } from './props';
import {
  FACADE_UPPER,
  FloorStyle,
  Tile,
  WALKABLE,
  WallStyle,
  type AmbientNpc,
  type Building,
  type MapLight,
  type PixelMap,
  type PlacedFacility,
  type Prop,
  type WorldLabel,
} from './types';

export interface BuildingSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  wall?: number;
  floor?: number;
  roof?: string;
  enterable?: boolean;
  /** Door x positions on the south facade. */
  doors?: number[];
  /** Extra doors anywhere on the perimeter. */
  sideDoors?: { x: number; y: number }[];
  /** Automatic facade decoration. */
  windows?: boolean;
  sign?: { text: string; color?: string; x?: number; w?: number; neon?: boolean };
  /** Ceiling lights inside. */
  lights?: string;
}

export class MapBuilder {
  tiles: Uint8Array;
  style: Uint8Array;
  props: Prop[] = [];
  buildings: Building[] = [];
  anchors: PixelMap['anchors'] = {};
  labels: WorldLabel[] = [];
  lights: MapLight[] = [];
  facilities: PlacedFacility[] = [];
  npcs: AmbientNpc[] = [];
  private n = 0;
  private rnd: () => number;

  constructor(
    readonly id: string,
    readonly w: number,
    readonly h: number,
  ) {
    this.tiles = new Uint8Array(w * h);
    this.style = new Uint8Array(w * h);
    this.rnd = seeded(hashString(id));
  }

  random() {
    return this.rnd();
  }

  set(x: number, y: number, tile: number, style = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[y * this.w + x] = tile;
    this.style[y * this.w + x] = style;
  }

  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return Tile.Void;
    return this.tiles[y * this.w + x];
  }

  fill(x: number, y: number, w: number, h: number, tile: number, style = 0) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, tile, style);
  }

  /** Rectangle outline of walls. */
  walls(x: number, y: number, w: number, h: number, style: number = WallStyle.Station) {
    for (let i = x; i < x + w; i++) {
      this.set(i, y, Tile.Wall, style);
      this.set(i, y + h - 1, Tile.Wall, style);
    }
    for (let j = y; j < y + h; j++) {
      this.set(x, j, Tile.Wall, style);
      this.set(x + w - 1, j, Tile.Wall, style);
    }
  }

  hwall(x: number, y: number, len: number, style: number = WallStyle.Station) {
    for (let i = x; i < x + len; i++) this.set(i, y, Tile.Wall, style);
  }

  vwall(x: number, y: number, len: number, style: number = WallStyle.Station) {
    for (let j = y; j < y + len; j++) this.set(x, j, Tile.Wall, style);
  }

  door(x: number, y: number, floor: number = FloorStyle.Tile, wall: number = WallStyle.Station) {
    this.set(x, y, Tile.Door, (wall << 4) | floor);
  }

  /** Horizontal road with sidewalks above and below. */
  hroad(y: number, x0: number, x1: number, lanes = 2, walk = 2, walkStyle = 0) {
    this.fill(x0, y - walk, x1 - x0 + 1, walk, Tile.Sidewalk, walkStyle);
    this.fill(x0, y, x1 - x0 + 1, lanes * 2, Tile.Asphalt);
    if (lanes >= 1) for (let x = x0; x <= x1; x += 2) this.set(x, y + lanes - (lanes > 1 ? 1 : 0), Tile.Marking, 0);
    this.fill(x0, y + lanes * 2, x1 - x0 + 1, walk, Tile.Sidewalk, walkStyle);
  }

  vroad(x: number, y0: number, y1: number, lanes = 2, walk = 2, walkStyle = 0) {
    this.fill(x - walk, y0, walk, y1 - y0 + 1, Tile.Sidewalk, walkStyle);
    this.fill(x, y0, lanes * 2, y1 - y0 + 1, Tile.Asphalt);
    for (let y = y0; y <= y1; y += 2) this.set(x + lanes - (lanes > 1 ? 1 : 0), y, Tile.Marking, 1);
    this.fill(x + lanes * 2, y0, walk, y1 - y0 + 1, Tile.Sidewalk, walkStyle);
  }

  crosswalkH(x: number, y: number, h: number) {
    for (let j = y; j < y + h; j++) this.set(x, j, Tile.Crosswalk, 1), this.set(x + 1, j, Tile.Crosswalk, 1);
  }

  crosswalkV(x: number, y: number, w: number) {
    for (let i = x; i < x + w; i++) this.set(i, y, Tile.Crosswalk, 0), this.set(i, y + 1, Tile.Crosswalk, 0);
  }

  building(spec: BuildingSpec): Building {
    const wall = spec.wall ?? WallStyle.Plaster;
    const floor = spec.floor ?? FloorStyle.Tile;
    const enter = spec.enterable ?? !!(spec.doors?.length || spec.sideDoors?.length);
    const roofs = ['#77716a', '#8a8378', '#64676b', '#938a7c', '#71757a', '#7d7064', '#9b9890'];
    const b: Building = {
      id: spec.id,
      x: spec.x,
      y: spec.y,
      w: spec.w,
      h: spec.h,
      roof: spec.roof ?? roofs[Math.floor(this.rnd() * roofs.length)],
      enterable: enter,
      seed: hashString(spec.id),
    };
    this.walls(spec.x, spec.y, spec.w, spec.h, wall);
    this.fill(spec.x + 1, spec.y + 1, spec.w - 2, spec.h - 3, enter ? Tile.Floor : Tile.Solid, floor);
    const fy = spec.y + spec.h - 1;
    // Two-storey facade: upper row is a full wall face.
    for (let x = spec.x; x < spec.x + spec.w; x++) this.set(x, fy - 1, Tile.Wall, wall | FACADE_UPPER);
    for (const dx of spec.doors ?? []) {
      this.door(spec.x + dx, fy, floor, wall);
      this.set(spec.x + dx, fy - 1, Tile.DoorTop, wall);
    }
    for (const d of spec.sideDoors ?? []) this.door(d.x, d.y, floor, wall);
    // Facade decoration.
    const doorXs = new Set((spec.doors ?? []).map((d) => spec.x + d));
    const signX = spec.sign ? spec.x + (spec.sign.x ?? Math.max(1, Math.floor((spec.w - (spec.sign.w ?? 3)) / 2))) : -1;
    const signW = spec.sign?.w ?? 3;
    if (spec.sign) {
      this.prop(spec.sign.neon ? 'neon' : 'sign', signX, fy - 1, { w: signW, text: spec.sign.text, color: spec.sign.color, name: spec.sign.text });
      if (spec.sign.neon && spec.sign.color)
        this.lights.push({ x: signX + signW / 2, y: fy + 0.5, r: 3.4, color: spec.sign.color, power: 0.6, flicker: true });
    }
    if (spec.windows !== false) {
      for (let x = spec.x + 1; x < spec.x + spec.w - 1; x++) {
        if (doorXs.has(x) || doorXs.has(x - 1) || doorXs.has(x + 1)) continue;
        const k = (x - spec.x) % 3;
        const underSign = spec.sign && x >= signX && x < signX + signW;
        if (k === 1) {
          const lit = this.rnd() < 0.6;
          if (!underSign) {
            this.prop('window', x, fy - 1, { variant: lit ? 1 : 0 });
            if (lit) this.lights.push({ x: x + 0.5, y: fy + 0.6, r: 1.8, color: '#f3c66b', power: 0.35 });
          }
          if (enter) this.prop('window', x, fy, { variant: lit ? 1 : 0 });
          else if (this.rnd() < 0.5) this.prop('shutter', x, fy, { w: 1 });
        } else if (k === 2 && this.rnd() < 0.3 && !underSign) this.prop('ac', x, fy - 1);
      }
    }
    if (enter) {
      const lc = spec.lights ?? '#fff4d6';
      for (let y = spec.y + 2; y < spec.y + spec.h - 2; y += 4)
        for (let x = spec.x + 2; x < spec.x + spec.w - 1; x += 5)
          this.lights.push({ x: x + 0.5, y: y + 0.5, r: 4.2, color: lc, power: 0.85, building: spec.id });
    }
    this.buildings.push(b);
    return b;
  }

  prop(type: string, x: number, y: number, opts: Partial<Prop> = {}): Prop {
    const def = PROPS[type];
    const p: Prop = { id: `${this.id}-${type}-${this.n++}`, type, x, y, w: def?.w ?? 1, h: def?.h ?? 1, ...opts };
    this.props.push(p);
    if (type === 'lamp') this.lights.push({ x: x + 0.9, y: y - 0.6, r: 4.6, color: '#ffd98a', power: 0.9, flicker: this.rnd() < 0.15 });
    return p;
  }

  anchor(name: string, x: number, y: number, dir: Dir = 0) {
    this.anchors[name] = { x, y, dir };
  }

  label(x: number, y: number, text: string, kind: WorldLabel['kind'] = 'street', building?: string) {
    this.labels.push({ x, y, text, kind, building });
  }

  light(x: number, y: number, r: number, color: string, power = 0.8, building?: string) {
    this.lights.push({ x, y, r, color, power, building });
  }

  facility(id: string, action: FacilityAction, label: string, x: number, y: number, dir: Dir = 0, object = false) {
    this.facilities.push({ id, action, label, x, y, dir, object });
  }

  npc(n: Omit<AmbientNpc, 'id'> & { id?: string }) {
    this.npcs.push({ id: n.id ?? `${this.id}-npc-${this.npcs.length}`, ...n });
  }

  build(meta: Omit<PixelMap, 'w' | 'h' | 'tiles' | 'style' | 'blocked' | 'props' | 'buildings' | 'anchors' | 'labels' | 'lights' | 'facilities' | 'npcs'>): PixelMap {
    const blocked = new Uint8Array(this.w * this.h);
    for (let i = 0; i < blocked.length; i++) blocked[i] = WALKABLE.has(this.tiles[i]) ? 0 : 1;
    for (const p of this.props) {
      const def = PROPS[p.type];
      if (!def?.solid) continue;
      for (let j = p.y; j < p.y + p.h; j++)
        for (let i = p.x; i < p.x + p.w; i++) if (i >= 0 && j >= 0 && i < this.w && j < this.h) blocked[j * this.w + i] = 1;
    }
    return {
      ...meta,
      w: this.w,
      h: this.h,
      tiles: this.tiles,
      style: this.style,
      blocked,
      props: this.props,
      buildings: this.buildings,
      anchors: this.anchors,
      labels: this.labels,
      lights: this.lights,
      facilities: this.facilities,
      npcs: this.npcs,
    };
  }
}

/** Quick look builder for background characters. */
export function look(
  body: 'male' | 'female',
  skin: string,
  hairStyle: CharacterLook['hairStyle'],
  hairColor: string,
  outfit: CharacterLook['outfit'],
  topColor: string,
  pantsColor = '#22252b',
  extra: Partial<CharacterLook> = {},
): CharacterLook {
  return { body, skin, hairStyle, hairColor, outfit, topColor, pantsColor, ...extra };
}
