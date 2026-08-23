export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Parses "h:mm:ss", "m:ss", or a bare number of seconds back into seconds. */
export function parseTimestampInput(value: string): number | null {
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);

  const match = trimmed.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m, s] = match;
  return (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10);
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  if (m < 1) return `${s}s`;
  const rem = s % 60;
  return rem === 0 ? `${m} min` : `${m}m ${rem}s`;
}
