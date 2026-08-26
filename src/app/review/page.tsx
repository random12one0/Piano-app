import Link from "next/link";
import { getFlaggedSegments } from "@/lib/queries";
import ReviewQueueItem from "@/components/ReviewQueueItem";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const flagged = await getFlaggedSegments();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-[calc(3rem+env(safe-area-inset-top))] sm:px-10 sm:pt-16">
      <Link
        href="/"
        className="mb-8 inline-block font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
      >
        ← Library
      </Link>

      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-flag">Review queue</p>
        <h1 className="font-display text-4xl italic text-foreground sm:text-5xl">Struggling with these</h1>
        <span aria-hidden className="mt-4 mb-4 block h-[2px] w-16 bg-accent" />
        <p className="max-w-xl font-sans text-sm text-foreground-dim">
          Segments you&rsquo;ve flagged, pulled off their rails and gathered here. No scores, no
          schedule — just the list of what to revisit next time you sit down to practice.
        </p>
      </header>

      {flagged.length === 0 ? (
        <p className="font-mono text-sm text-foreground-dim">
          Nothing flagged right now. Flag a segment from its practice view when it needs another pass.
        </p>
      ) : (
        <div>
          {flagged.map((segment) => (
            <ReviewQueueItem
              key={segment.id}
              songId={segment.songId}
              segmentId={segment.id}
              songTitle={segment.song.title}
              segmentTitle={segment.title}
              videoTitle={segment.video.title}
              notes={segment.notes}
              transcriptExcerpt={segment.transcriptExcerpt}
            />
          ))}
        </div>
      )}
    </div>
  );
}
