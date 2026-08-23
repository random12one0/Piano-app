import type { ParsedCaptionLine } from "./captions";

export type ChapterProposal = {
  title: string;
  startSeconds: number;
  endSeconds: number;
  transcriptExcerpt: string;
};

// Phrases a piano instructor tends to say right at a natural teaching-section
// boundary — isolating a hand, changing tempo, or moving to a new passage.
// This is a lightweight cue-phrase + pause heuristic, not NLP: it proposes
// breaks for a human to confirm or edit, never commits them silently.
const CUE_PHRASES = [
  /\bright hand\b/i,
  /\bleft hand\b/i,
  /\bhands together\b/i,
  /\bboth hands\b/i,
  /\bfull tempo\b/i,
  /\bfull speed\b/i,
  /\bat tempo\b/i,
  /\bslow(ly)? down\b/i,
  /\blet'?s (now |also )?(try|add|move|slow|speed|put|start|begin|look at|break)/i,
  /\bnow let'?s\b/i,
  /\bmoving on\b/i,
  /\bnext (section|part|phrase|bit)\b/i,
  /\bfrom the top\b/i,
  /\bone more time\b/i,
  /\bput it together\b/i,
  /\b(the )?bridge\b/i,
  /\b(the )?chorus\b/i,
  /\b(the )?verse\b/i,
  /\bintroduction\b|\bintro\b/i,
];

const PAUSE_GAP_SECONDS = 1.75;
const MIN_CHAPTER_SECONDS = 25;

function looksLikeCue(text: string): boolean {
  return CUE_PHRASES.some((re) => re.test(text));
}

function titleFromLine(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const clipped = trimmed.length > 60 ? trimmed.slice(0, 57).trimEnd() + "…" : trimmed;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

/**
 * Proposes chapter breaks from a timestamped transcript. Combines two
 * signals: a pause longer than PAUSE_GAP_SECONDS between lines, and a line
 * whose text matches a teaching-transition cue phrase. Either alone can
 * start a candidate chapter; short candidates get merged forward so we
 * don't over-segment on every aside.
 */
export function proposeChapters(lines: ParsedCaptionLine[]): ChapterProposal[] {
  if (lines.length === 0) return [];

  const sorted = [...lines].sort((a, b) => a.startSeconds - b.startSeconds);

  type Break = { index: number; reason: "cue" | "pause" };
  const breaks: Break[] = [{ index: 0, reason: "cue" }];

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startSeconds - sorted[i - 1].endSeconds;
    const cue = looksLikeCue(sorted[i].text);
    if (cue || gap >= PAUSE_GAP_SECONDS) {
      breaks.push({ index: i, reason: cue ? "cue" : "pause" });
    }
  }

  // Build raw chapters from break points.
  type RawChapter = { startIndex: number; endIndex: number };
  const raw: RawChapter[] = breaks.map((b, i) => ({
    startIndex: b.index,
    endIndex: (breaks[i + 1]?.index ?? sorted.length) - 1,
  }));

  // Merge chapters shorter than MIN_CHAPTER_SECONDS into the next one, so a
  // single aside doesn't become its own chapter.
  const merged: RawChapter[] = [];
  for (const chapter of raw) {
    const duration = sorted[chapter.endIndex].endSeconds - sorted[chapter.startIndex].startSeconds;
    const prev = merged[merged.length - 1];
    if (prev && duration < MIN_CHAPTER_SECONDS) {
      prev.endIndex = chapter.endIndex;
    } else {
      merged.push({ ...chapter });
    }
  }
  // A too-short trailing chapter merges back into the previous one.
  if (merged.length > 1) {
    const last = merged[merged.length - 1];
    const lastDuration = sorted[last.endIndex].endSeconds - sorted[last.startIndex].startSeconds;
    if (lastDuration < MIN_CHAPTER_SECONDS) {
      merged[merged.length - 2].endIndex = last.endIndex;
      merged.pop();
    }
  }

  return merged.map((chapter) => {
    const chapterLines = sorted.slice(chapter.startIndex, chapter.endIndex + 1);
    const titleLine = chapterLines.find((l) => looksLikeCue(l.text)) ?? chapterLines[0];
    return {
      title: titleFromLine(titleLine.text),
      startSeconds: chapterLines[0].startSeconds,
      endSeconds: chapterLines[chapterLines.length - 1].endSeconds,
      transcriptExcerpt: chapterLines
        .map((l) => l.text)
        .join(" ")
        .slice(0, 400),
    };
  });
}
