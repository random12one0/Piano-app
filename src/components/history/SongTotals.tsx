"use client";

import Link from "next/link";
import { formatMinutes, relativeDay } from "@/lib/practice";
import { EYEBROW } from "@/lib/ui";

/** Where the time actually went, most-practised first. */
export default function SongTotals({
  sessions,
  songs,
}: {
  sessions: { songId: string; endedAt: string; secondsPracticed: number }[];
  songs: { id: string; title: string }[];
}) {
  const byId = new Map<string, { seconds: number; sittings: number; last: Date }>();
  for (const s of sessions) {
    const at = new Date(s.endedAt);
    const row = byId.get(s.songId);
    if (row) {
      row.seconds += s.secondsPracticed;
      row.sittings += 1;
      if (at > row.last) row.last = at;
    } else {
      byId.set(s.songId, { seconds: s.secondsPracticed, sittings: 1, last: at });
    }
  }

  const rows = songs
    .map((song) => ({ song, stats: byId.get(song.id) }))
    .filter((r): r is { song: { id: string; title: string }; stats: NonNullable<ReturnType<typeof byId.get>> } =>
      Boolean(r.stats),
    )
    .sort((a, b) => b.stats.seconds - a.stats.seconds);

  const max = rows[0]?.stats.seconds ?? 1;

  return (
    <div>
      <p className={`mb-4 ${EYEBROW} text-foreground-dim`}>
        By song
      </p>
      <ul className="flex flex-col">
        {rows.map(({ song, stats }) => (
          <li key={song.id}>
            <Link
              href={`/songs/${song.id}`}
              className="group flex min-h-14 items-center gap-4 py-2 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-lg text-foreground transition-colors group-hover:text-accent">
                  {song.title}
                </span>
                <span className="mt-1 block h-[3px] w-full bg-surface-raised">
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${Math.max(4, (stats.seconds / max) * 100)}%` }}
                  />
                </span>
              </span>
              <span className="shrink-0 text-right font-mono text-xs text-foreground-dim">
                <span className="block tabular-nums">{formatMinutes(stats.seconds)}</span>
                <span className="block text-foreground-dim/70">{relativeDay(stats.last)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
