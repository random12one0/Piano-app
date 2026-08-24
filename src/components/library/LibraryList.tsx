"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SegmentRail from "@/components/rail/SegmentRail";

type RailSegment = {
  id: string;
  title: string;
  status: string;
  videoId: string;
  video: { title: string };
};

export type LibrarySong = {
  id: string;
  title: string;
  instructorNotes: string;
  lastSegmentId: string | null;
  thumbnailUrl: string | null;
  segments: RailSegment[];
};

const SCROLL_KEY = "practice-rail:library-scroll";

function useScrollRestoration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("sessionStorage" in window)) return;

    const previous = window.history.scrollRestoration;
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // Some browsers disallow setting this — restoration below still works.
    }

    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const y = Number.parseInt(saved, 10);
      if (!Number.isNaN(y)) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      try {
        window.history.scrollRestoration = previous;
      } catch {
        // ignore
      }
    };
  }, []);
}

function Thumbnail({ song }: { song: LibrarySong }) {
  if (song.thumbnailUrl) {
    return (
      <img
        src={song.thumbnailUrl}
        alt=""
        loading="lazy"
        className="h-16 w-24 shrink-0 border border-rule object-cover grayscale-[15%] transition-[filter] duration-200 group-hover:grayscale-0 sm:h-20 sm:w-28"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-16 w-24 shrink-0 items-center justify-center border border-rule bg-surface sm:h-20 sm:w-28"
    >
      <span className="font-display text-2xl italic text-accent/70">{song.title.charAt(0)}</span>
    </div>
  );
}

export default function LibraryList({ songs }: { songs: LibrarySong[] }) {
  useScrollRestoration();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((song) => song.title.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div>
      <div className="mb-12">
        <label className="relative block max-w-sm">
          <span className="sr-only">Search songs</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the library…"
            className="w-full border border-rule bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none transition-colors placeholder:text-foreground-dim/50 focus:border-accent"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="font-mono text-sm text-foreground-dim">
          No songs match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-2">
          {filtered.map((song) => {
            const total = song.segments.length;
            const done = song.segments.filter((s) => s.status === "done").length;
            const flagged = song.segments.filter((s) => s.status === "needs_review").length;

            return (
              <section key={song.id} className="border-b border-rule py-8 first:pt-0">
                <Link href={`/songs/${song.id}`} className="group flex gap-4">
                  <Thumbnail song={song} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="font-display text-xl text-foreground transition-colors group-hover:text-accent sm:text-2xl">
                        {song.title}
                      </span>
                      <span className="whitespace-nowrap font-mono text-xs text-foreground-dim">
                        {done}/{total}
                        {flagged > 0 ? <span className="text-flag"> · {flagged}</span> : null}
                      </span>
                    </div>
                    {song.instructorNotes && (
                      <p className="line-clamp-1 font-sans text-sm italic text-foreground-dim">
                        {song.instructorNotes}
                      </p>
                    )}
                  </div>
                </Link>
                <div className="mt-4">
                  <SegmentRail songId={song.id} segments={song.segments} currentSegmentId={song.lastSegmentId} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
