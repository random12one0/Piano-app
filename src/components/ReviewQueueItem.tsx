"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleStruggling } from "@/lib/actions";

export default function ReviewQueueItem({
  songId,
  segmentId,
  songTitle,
  segmentTitle,
  videoTitle,
  notes,
  transcriptExcerpt,
}: {
  songId: string;
  segmentId: string;
  songTitle: string;
  segmentTitle: string;
  videoTitle: string;
  notes: string;
  transcriptExcerpt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleResolve() {
    startTransition(async () => {
      await toggleStruggling(segmentId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 py-6">
      <span className="mt-1.5 block h-2.5 w-2.5 shrink-0 rotate-45 bg-flag" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
          {songTitle} · {videoTitle}
        </p>
        <Link
          href={`/songs/${songId}?segment=${segmentId}`}
          className="font-display text-lg text-foreground transition-colors hover:text-accent"
        >
          {segmentTitle}
        </Link>
        {notes && <p className="mt-1 font-sans text-sm text-foreground-dim">{notes}</p>}
        {!notes && transcriptExcerpt && (
          <p className="mt-1 font-sans text-sm italic text-foreground-dim">&ldquo;{transcriptExcerpt}&rdquo;</p>
        )}
      </div>
      <div className="flex w-full shrink-0 items-center gap-5 pl-6 sm:w-auto sm:pl-0">
        <Link
          href={`/songs/${songId}?segment=${segmentId}`}
          className="inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-wider text-accent transition-colors hover:text-accent-bright"
        >
          Resume
        </Link>
        <button
          type="button"
          onClick={handleResolve}
          disabled={isPending}
          className="inline-flex min-h-11 cursor-pointer items-center font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-foreground disabled:opacity-50"
        >
          Clear flag
        </button>
      </div>
    </div>
  );
}
