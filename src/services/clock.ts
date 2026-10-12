// The game clock: minutes since the first morning at the station. It moves
// while the detective walks the streets and with every step of the
// investigation. Some people keep hours: a night kiosk opens in the evening,
// a clerk goes home at four.

/** The first shift starts at eight in the morning. */
export const START_CLOCK = 8 * 60;
/** Real seconds per tick, and game minutes per tick, while in the field. */
export const CLOCK_TICK_SECONDS = 30;
export const CLOCK_TICK_MINUTES = 20;

/** Game minutes that a step of the investigation takes. */
export const TIME_COST: Record<string, number> = {
  VISIT_HOTSPOT: 20,
  ANALYZE_LAB: 40,
  START_INTERROGATION: 60,
  TRAVEL: 15,
};

export const minuteOfDay = (clock: number) => ((clock % 1440) + 1440) % 1440;
export const hourOf = (clock: number) => Math.floor(minuteOfDay(clock) / 60);
export const dayOf = (clock: number) => Math.floor(clock / 1440) + 1;

const pad = (n: number) => String(n).padStart(2, '0');
export const formatClock = (clock: number) => `${pad(hourOf(clock))}:${pad(minuteOfDay(clock) % 60)}`;
export const formatHour = (h: number) => `${pad(h % 24)}:00`;
export const hoursLabel = (hours: [number, number]) => `${formatHour(hours[0])}-${formatHour(hours[1])}`;

/** Whether someone keeping these hours is there now. [20, 5] wraps past midnight. */
export function isOpen(hours: [number, number] | undefined, clock: number): boolean {
  if (!hours) return true;
  const [from, to] = hours;
  const h = minuteOfDay(clock) / 60;
  return from < to ? h >= from && h < to : h >= from || h < to;
}

/** Game minutes from now until the given hour comes around. */
export function minutesUntil(clock: number, hour: number): number {
  const d = hour * 60 - minuteOfDay(clock);
  return d > 0 ? d : d + 1440;
}

/** 0 in full daylight, 1 deep at night, with dusk and dawn in between. */
export function nightFactor(clock: number): number {
  const h = minuteOfDay(clock) / 60;
  if (h >= 8 && h < 17) return 0;
  if (h >= 17 && h < 20) return (h - 17) / 3;
  if (h >= 5 && h < 8) return 1 - (h - 5) / 3;
  return 1;
}

export const isNight = (clock: number) => nightFactor(clock) > 0.5;
