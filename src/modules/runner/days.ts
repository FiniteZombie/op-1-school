// Local calendar days as `YYYY-MM-DD` keys: the streak, "today's session" and the export's date all go by the owner's clock.

const pad = (n: number): string => String(n).padStart(2, '0');

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The key of the day before `key`. Noon, so a daylight-saving jump can't skip a date. */
export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}
