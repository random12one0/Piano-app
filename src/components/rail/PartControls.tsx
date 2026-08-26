"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVideo, moveVideo, updateVideoTitle } from "@/lib/actions";

/**
 * Rename, reorder, or remove a whole part of a song. Lesson series don't
 * always arrive in order — a part ingested late used to sit at the end of the
 * song permanently, with no way to move it or take it back out.
 */
export default function PartControls({
  songId,
  videoId,
  title,
  canMoveUp,
  canMoveDown,
  segmentCount,
}: {
  songId: string;
  videoId: string;
  title: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  segmentCount: number;
}) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await work();
        router.refresh();
      } catch {
        // The list re-renders from the server either way; a failed move or
        // delete simply leaves things as they were.
        router.refresh();
      }
    });
  }

  function handleDelete() {
    const ok = window.confirm(
      `Remove "${title}" from this song? Its ${segmentCount} segment${
        segmentCount === 1 ? "" : "s"
      } and their notes go with it.`,
    );
    if (!ok) return;
    run(() => deleteVideo(songId, videoId));
  }

  const iconClass =
    "inline-flex min-h-11 min-w-9 cursor-pointer items-center justify-center font-mono text-xs text-foreground-dim transition-colors hover:text-accent disabled:opacity-30";

  if (renaming) {
    return (
      <div className="flex w-full items-center gap-2">
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-11 min-w-0 flex-1 border border-rule bg-surface px-2 font-sans text-base text-foreground focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={isPending || !draft.trim()}
          onClick={() => {
            run(() => updateVideoTitle(videoId, draft));
            setRenaming(false);
          }}
          className={iconClass}
          aria-label="Save part name"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(title);
            setRenaming(false);
          }}
          className={iconClass}
          aria-label="Cancel rename"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        disabled={isPending || !canMoveUp}
        onClick={() => run(() => moveVideo(songId, videoId, "up"))}
        className={iconClass}
        aria-label={`Move ${title} earlier`}
      >
        ↑
      </button>
      <button
        type="button"
        disabled={isPending || !canMoveDown}
        onClick={() => run(() => moveVideo(songId, videoId, "down"))}
        className={iconClass}
        aria-label={`Move ${title} later`}
      >
        ↓
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => setRenaming(true)}
        className={iconClass}
        aria-label={`Rename ${title}`}
      >
        ✎
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        className={`${iconClass} hover:text-flag`}
        aria-label={`Remove ${title}`}
      >
        ✕
      </button>
    </div>
  );
}
