"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { resetSongProgress } from "@/lib/actions";
import SongEditDialog from "./SongEditDialog";

/**
 * The song's occasional actions, folded behind one button. They used to sit
 * in a row under the title — about 430px of chrome that pushed the video
 * below the fold on a phone — and "Reset progress", which wipes the song,
 * sat inline one tap away from things you use constantly.
 */
export default function SongMenu({
  songId,
  songTitle,
  instructorNotes,
  sheetMusicUrl,
}: {
  songId: string;
  songTitle: string;
  instructorNotes: string;
  sheetMusicUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex min-h-11 w-full items-center px-4 text-left font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:bg-surface hover:text-accent";

  function handleReset() {
    setOpen(false);
    const ok = window.confirm(
      "Reset all progress for this song? This clears status, notes, and resume position for every segment.",
    );
    if (!ok) return;
    startTransition(() => {
      resetSongProgress(songId);
    });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Song options"
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center font-mono text-lg leading-none text-foreground-dim transition-colors hover:text-accent"
      >
        {isPending ? "…" : "⋯"}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 w-56 border border-rule bg-background py-1 shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
        >
          {sheetMusicUrl && (
            <a
              href={sheetMusicUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              Sheet music ↗
            </a>
          )}
          <Link
            href={`/songs/${songId}/ingest`}
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            + Add video
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setEditing(true);
            }}
            className={`${itemClass} cursor-pointer`}
          >
            Rename / edit…
          </button>
          <div className="my-1 h-px bg-rule/60" aria-hidden />
          <button
            type="button"
            role="menuitem"
            onClick={handleReset}
            disabled={isPending}
            className={`${itemClass} cursor-pointer hover:text-flag disabled:opacity-50`}
          >
            {isPending ? "Resetting…" : "Reset progress"}
          </button>
        </div>
      )}

      {editing && (
        <SongEditDialog
          songId={songId}
          title={songTitle}
          instructorNotes={instructorNotes}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
