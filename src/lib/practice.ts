/** Local-day helpers for practice history. */

/** `YYYY-MM-DD` in the viewer's own timezone — the server runs in UTC, so
 *  bucketing has to happen where the calendar the user reads lives. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The last `count` day keys, oldest first, ending today. */
export function recentDayKeys(count: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d));
  }
  return keys;
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return "under a minute";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} hr` : `${h}h ${rem}m`;
}

/** "today" / "yesterday" / "Tuesday" / "12 Mar" — closest useful granularity. */
export function relativeDay(date: Date, today = new Date()): string {
  const days = Math.round(
    (new Date(dayKey(today)).getTime() - new Date(dayKey(date)).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
