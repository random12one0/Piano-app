"use client";

import { useTransition } from "react";
import { resetAllProgress, resetSongProgress } from "@/lib/actions";

export default function ResetProgressButton({
  songId,
  label = "Reset progress",
}: {
  songId?: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const message = songId
      ? "Reset all progress for this song? This clears status, notes, and resume position for every segment."
      : "Reset ALL progress across your entire library? This clears status, notes, and resume position for every song. This can't be undone.";
    if (!window.confirm(message)) return;
    startTransition(() => {
      if (songId) resetSongProgress(songId);
      else resetAllProgress();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="cursor-pointer font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim transition-colors hover:text-flag disabled:opacity-50"
    >
      {isPending ? "Resetting…" : label}
    </button>
  );
}
