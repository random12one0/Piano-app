"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSong, updateSong } from "@/lib/actions";

export default function SongEditDialog({
  songId,
  title,
  instructorNotes,
  onClose,
}: {
  songId: string;
  title: string;
  instructorNotes: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNotes, setDraftNotes] = useState(instructorNotes);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!draftTitle.trim()) {
      setError("Give the song a title.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateSong(songId, { title: draftTitle, instructorNotes: draftNotes });
        onClose();
        router.refresh();
      } catch {
        setError("Couldn't save that.");
      }
    });
  }

  function handleDelete() {
    const ok = window.confirm(
      `Delete "${title}" for good? Every segment, note, and bit of progress for this song goes with it.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteSong(songId);
        router.push("/");
      } catch {
        setError("Couldn't delete that.");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit song"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 pt-[max(3rem,env(safe-area-inset-top))]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 border border-rule bg-background p-5 shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
        <p className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Edit song</p>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Title</span>
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            className="min-h-11 w-full border border-rule bg-surface px-3 font-sans text-base text-foreground focus:border-accent focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
            Instructor notes
          </span>
          <textarea
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            rows={3}
            className="w-full resize-none border border-rule bg-surface px-3 py-2 font-sans text-base text-foreground focus:border-accent focus:outline-none"
          />
        </label>

        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex min-h-11 cursor-pointer items-center border border-accent bg-accent px-4 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 cursor-pointer items-center border border-rule px-4 font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:border-accent hover:text-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="ml-auto inline-flex min-h-11 cursor-pointer items-center px-2 font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-flag disabled:opacity-50"
          >
            Delete song
          </button>
        </div>
      </div>
    </div>
  );
}
