import type { CharacterLook, FacilityHotspot } from '../../types/investigation';
import type { Dir } from '../person';

export const T = 16;

export const Tile = {
  Void: 0,
  Wall: 1,
  Floor: 2,
  Asphalt: 3,
  Sidewalk: 4,
  Grass: 5,
  Dirt: 6,
  Concrete: 7,
  Door: 8,
  Marking: 9,
  Crosswalk: 10,
  Parking: 11,
  Dance: 12,
  Solid: 13,
  Platform: 14,
  /** Upper half of a doorway in a two-storey facade. */
  DoorTop: 15,
} as const;

export const WALKABLE = new Set<number>([
  Tile.Floor,
  Tile.Asphalt,
  Tile.Sidewalk,
  Tile.Grass,
  Tile.Dirt,
  Tile.Concrete,
  Tile.Door,
  Tile.Marking,
  Tile.Crosswalk,
  Tile.Parking,
  Tile.Dance,
  Tile.Platform,
  Tile.DoorTop,
]);

/** Wall style flag: upper facade row (full face, no baseboard). */
export const FACADE_UPPER = 0x40;

/** Wall materials. */
export const WallStyle = {
  Station: 0,
  Plaster: 1,
  White: 2,
  Brick: 3,
  Concrete: 4,
  Club: 5,
  Stone: 6,
  BlueTile: 7,
  Pink: 8,
} as const;

/** Floor materials. */
export const FloorStyle = {
  Tile: 0,
  Lab: 1,
  Wood: 2,
  Carpet: 3,
  Checker: 4,
  Concrete: 5,
  Club: 6,
  Lino: 7,
  Terrazzo: 8,
} as const;

export interface Prop {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  text?: string;
  variant?: number;
  name?: string;
  examine?: string;
  /** Facility triggered when this prop is used (e.g. the detective's desk). */
  facility?: string;
}

export interface Building {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  enterable: boolean;
  name?: string;
  seed: number;
}

export interface MapLight {
  x: number;
  y: number;
  r: number;
  color: string;
  power: number;
  flicker?: boolean;
  /** Only shines when the roof of this building is open (interior lights). */
  building?: string;
}

export interface WorldLabel {
  x: number;
  y: number;
  text: string;
  kind: 'street' | 'room';
  building?: string;
}

export interface AmbientNpc {
  id: string;
  x: number;
  y: number;
  dir: Dir;
  name: string;
  role: string;
  look: CharacterLook;
  lines: string[];
  /** What they say once they have told everything. */
  done?: string;
  /** Walking route (tile coordinates); static when absent. */
  path?: { x: number; y: number }[];
  speed?: number;
}

export interface PlacedFacility extends FacilityHotspot {
  dir: Dir;
  /** Facility handled by an object rather than a person. */
  object?: boolean;
}

export interface PixelMap {
  id: string;
  name: string;
  district: string;
  description: string;
  ambient: 'station' | 'street' | 'club';
  w: number;
  h: number;
  tiles: Uint8Array;
  style: Uint8Array;
  blocked: Uint8Array;
  props: Prop[];
  buildings: Building[];
  anchors: Record<string, { x: number; y: number; dir: Dir }>;
  spawn: { x: number; y: number };
  labels: WorldLabel[];
  lights: MapLight[];
  facilities: PlacedFacility[];
  npcs: AmbientNpc[];
  darkness: number;
  rain: boolean;
}
