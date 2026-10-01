/** Plant clock helpers. The plant runs on the viewer's local time zone. */
import { PROD_DAY_START_H } from "./model";

export interface ClockParts {
  /** Fractional hour 0–24. */
  hour: number;
  /** Start of the local day (00:00) in epoch ms. */
  dayStart: number;
}

export function clockParts(ms: number): ClockParts {
  const d = new Date(ms);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return { hour: (ms - dayStart) / 3600_000, dayStart };
}

export interface ProdParts {
  /** Local midnight of the production date. */
  date: number;
  /** Instant the production day starts (03:00 of the production date). */
  start: number;
  /** Hours since the production date's midnight: 3 to 27. */
  hour: number;
}

/** Production day: 03:00 to 03:00, so shift 2, its overtime and the late packing stay in the day they started. */
export function prodParts(ms: number): ProdParts {
  const d = new Date(ms);
  const back = d.getHours() < PROD_DAY_START_H ? 1 : 0;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate() - back;
  const date = new Date(y, m, day).getTime();
  return { date, start: new Date(y, m, day, PROD_DAY_START_H).getTime(), hour: (ms - date) / 3600_000 };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtClock(ms: number, withSeconds = false): string {
  const d = new Date(ms);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base;
}

export function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Fractional hour (may exceed 24 for overtime past midnight) → "00:45". */
export function fmtHour(h: number): string {
  const m = Math.round(h * 60);
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
}

/** Duration in minutes → "2h 51min". */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${pad(m % 60)}min` : `${m} min`;
}

/** Hours → "1h15", "2h" or "45 min". */
export function fmtH(h: number): string {
  const m = Math.round(h * 60);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)}h${pad(m % 60)}` : `${m / 60}h`;
}
