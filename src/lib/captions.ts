// Caption ingestion: turns an uploaded .srt / .vtt file, or a pasted
// YouTube transcript export, into a flat list of timestamped lines.
// Two input paths, one output shape — everything downstream (auto-chaptering,
// storage) works off ParsedCaptionLine[] regardless of where it came from.

export type ParsedCaptionLine = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

function timeToSeconds(h: string, m: string, s: string, ms: string): number {
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    parseInt(ms.padEnd(3, "0").slice(0, 3), 10) / 1000
  );
}

const SRT_TIME = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

/** Parses SubRip (.srt) caption files. */
export function parseSrt(raw: string): ParsedCaptionLine[] {
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\n+/);
  const lines: ParsedCaptionLine[] = [];

  for (const block of blocks) {
    const rows = block.split("\n").filter((r) => r.trim().length > 0);
    if (rows.length === 0) continue;

    const timeLineIndex = rows.findIndex((r) => SRT_TIME.test(r));
    if (timeLineIndex === -1) continue;

    const match = rows[timeLineIndex].match(SRT_TIME);
    if (!match) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
    const text = rows
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (!text) continue;

    lines.push({
      startSeconds: timeToSeconds(h1, m1, s1, ms1),
      endSeconds: timeToSeconds(h2, m2, s2, ms2),
      text,
    });
  }

  return lines;
}

const VTT_TIME = /(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d{2}:)?(\d{2}):(\d{2})[.,](\d{1,3})/;

/** Parses WebVTT (.vtt) caption files, including YouTube's exported format. */
export function parseVtt(raw: string): ParsedCaptionLine[] {
  const body = raw.replace(/\r\n/g, "\n").replace(/^WEBVTT.*\n/, "");
  const blocks = body.split(/\n\n+/);
  const lines: ParsedCaptionLine[] = [];

  for (const block of blocks) {
    const rows = block.split("\n").filter((r) => r.trim().length > 0);
    if (rows.length === 0) continue;

    const timeLineIndex = rows.findIndex((r) => VTT_TIME.test(r));
    if (timeLineIndex === -1) continue;

    const match = rows[timeLineIndex].match(VTT_TIME);
    if (!match) continue;

    const h1 = (match[1] ?? "00:").replace(":", "");
    const h2 = (match[5] ?? "00:").replace(":", "");
    const start = timeToSeconds(h1, match[2], match[3], match[4]);
    const end = timeToSeconds(h2, match[6], match[7], match[8]);

    const text = rows
      .slice(timeLineIndex + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
    if (!text) continue;

    lines.push({ startSeconds: start, endSeconds: end, text });
  }

  return dedupeAdjacent(lines);
}

// YouTube's auto-caption VTT re-emits near-duplicate rolling-text cues
// (word-by-word karaoke effect). Collapse consecutive lines whose text is a
// prefix/suffix of the next, keeping the longest version at the earliest start.
function dedupeAdjacent(lines: ParsedCaptionLine[]): ParsedCaptionLine[] {
  const out: ParsedCaptionLine[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && (line.text.startsWith(prev.text) || prev.text.startsWith(line.text))) {
      out[out.length - 1] = {
        startSeconds: prev.startSeconds,
        endSeconds: line.endSeconds,
        text: line.text.length > prev.text.length ? line.text : prev.text,
      };
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Detects format from filename/content and parses accordingly. */
export function parseCaptionFile(filename: string, raw: string): ParsedCaptionLine[] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".vtt") || raw.trim().startsWith("WEBVTT")) {
    return parseVtt(raw);
  }
  return parseSrt(raw);
}
