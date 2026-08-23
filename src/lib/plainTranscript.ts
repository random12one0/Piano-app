import type { ParsedCaptionLine } from "./captions";

const LINE = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+?)\s*$/;

/**
 * Parses a pasted plain-text transcript where each line starts with a
 * timestamp (h:mm:ss or m:ss) followed by the spoken text — the shape you
 * get from copying a YouTube transcript panel by hand. End time of each
 * cue is inferred as the start of the next line.
 */
export function parsePlainTimedText(raw: string): ParsedCaptionLine[] {
  const rows: { start: number; text: string }[] = [];

  for (const rawLine of raw.split("\n")) {
    const match = rawLine.match(LINE);
    if (!match) continue;
    const [, h, m, s, text] = match;
    const start = (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10);
    rows.push({ start, text: text.trim() });
  }

  return rows.map((row, i) => ({
    startSeconds: row.start,
    endSeconds: rows[i + 1] ? rows[i + 1].start : row.start + 4,
    text: row.text,
  }));
}
