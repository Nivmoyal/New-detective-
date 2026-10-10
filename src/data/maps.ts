import type { PixelMap } from '../pixel/world/types';
import { buildStation } from '../pixel/world/maps/station';
import { buildLevinsky } from '../pixel/world/maps/levinsky';
import { buildNeveShaanan } from '../pixel/world/maps/neveShaanan';
import { buildOldCbs } from '../pixel/world/maps/oldCbs';
import { buildFlorentin } from '../pixel/world/maps/florentin';
import { buildShapira } from '../pixel/world/maps/shapira';

export const STATION_MAP_ID = 'station';

export const MAPS: Record<string, PixelMap> = {
  station: buildStation(),
  levinsky: buildLevinsky(),
  neveShaanan: buildNeveShaanan(),
  oldCbs: buildOldCbs(),
  florentin: buildFlorentin(),
  shapira: buildShapira(),
};

export const SCENE_MAP_IDS = ['levinsky', 'neveShaanan', 'oldCbs', 'florentin', 'shapira'];
