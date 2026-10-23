// Dates and durations, always in Vienna time and with tabular figures in the markup.

import { TIME_ZONE } from '@passayge/core';

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, ...opts });
const DAY = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const DAY_SHORT = fmt({ day: 'numeric', month: 'short' });
const TIME = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
const TIME_S = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const WEEKDAY = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDay = (iso: string | Date) => DAY.format(new Date(iso));
export const fmtDayShort = (iso: string | Date) => DAY_SHORT.format(new Date(iso));
export const fmtTime = (iso: string | Date) => TIME.format(new Date(iso));
export const fmtTimeS = (iso: string | Date) => TIME_S.format(new Date(iso));
export const fmtDateTime = (iso: string | Date) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
export const fmtWeekday = (iso: string | Date) => WEEKDAY.format(new Date(iso)).replace(',', '');

/** The calendar day in Vienna, for grouping log rows. */
export const dayKey = (iso: string) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/** "61 days, 20 hours" style, for time left in a window. */
export function fmtDuration(ms: number): string {
  if (ms <= 0) return '0 hours';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  const d = days ? `${days} day${days === 1 ? '' : 's'}` : '';
  const hh = h ? `${h} hour${h === 1 ? '' : 's'}` : '';
  if (d && hh) return `${d}, ${hh}`;
  return d || hh || 'less than an hour';
}

/** Whole years on a given day, from a YYYY-MM-DD birth date. */
export function ageOn(birthDate: string, on: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  const parts = fmt({ year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(on);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const before = get('month') < m || (get('month') === m && get('day') < d);
  return get('year') - y - (before ? 1 : 0);
}

/** "0495 140362" for display. */
export const fmtSvnr = (v: string) => v.replace(/\s/g, '').replace(/^(\d{4})(\d{6})$/, '$1 $2');
