/** Extracts the URL= line from a Windows .url "Internet Shortcut" file. */
export function parseShortcutUrl(raw: string): string | null {
  const match = raw.match(/^URL=(.+)$/m);
  return match ? match[1].trim() : null;
}

const YOUTUBE_ID = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/** Extracts an 11-character YouTube video ID from a shortcut's URL, if any. */
export function extractYouTubeId(raw: string): string | null {
  const url = parseShortcutUrl(raw);
  if (!url) return null;
  const match = url.match(YOUTUBE_ID);
  return match ? match[1] : null;
}
