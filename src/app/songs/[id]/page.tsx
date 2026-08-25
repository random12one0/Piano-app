import Link from "next/link";
import { notFound } from "next/navigation";
import { getSongWithSegments } from "@/lib/queries";
import SegmentRail from "@/components/rail/SegmentRail";
import SegmentControls from "@/components/SegmentControls";
import PracticePlayer from "@/components/player/PracticePlayer";
import { formatTimestamp } from "@/lib/format";
import { isValidStatus } from "@/lib/status";
import { mediaUrl } from "@/lib/media";
import ResetProgressButton from "@/components/ResetProgressButton";

export const dynamic = "force-dynamic";

export default async function SongDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const { id } = await params;
  const { segment: segmentParam } = await searchParams;
  const song = await getSongWithSegments(id);
  if (!song) notFound();

  const current =
    song.segments.find((s) => s.id === segmentParam) ??
    song.segments.find((s) => s.id === song.lastSegmentId) ??
    song.segments[0] ??
    null;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-10 sm:pb-24 sm:pt-12">
      <Link
        href="/"
        className="mb-6 inline-block font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent sm:mb-8"
      >
        ← Library
      </Link>

      <header className="mb-8 sm:mb-10">
        <h1 className="font-display text-2xl italic text-foreground sm:text-4xl">{song.title}</h1>
        <span aria-hidden className="mt-4 mb-4 block h-[2px] w-16 bg-accent" />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {song.sheetMusicKey && (
            <a
              href={mediaUrl(song.sheetMusicKey)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
            >
              Sheet music ↗
            </a>
          )}
          <Link
            href={`/songs/${song.id}/ingest`}
            className="font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
          >
            + Add video
          </Link>
          <ResetProgressButton songId={song.id} />
        </div>
        {song.instructorNotes && (
          <p className="mt-3 max-w-2xl font-sans text-sm italic text-foreground-dim">{song.instructorNotes}</p>
        )}
      </header>

      <div className="mb-10">
        <SegmentRail songId={song.id} segments={song.segments} currentSegmentId={current?.id ?? null} />
      </div>

      {!current ? (
        <p className="font-mono text-sm text-foreground-dim">
          No segments yet.{" "}
          <Link href={`/songs/${song.id}/ingest`} className="text-accent underline underline-offset-4">
            Ingest a lesson video
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div>
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-wider text-foreground-dim">
                {current.video.title}
              </p>
              <h2 className="font-display text-xl text-foreground">{current.title}</h2>
              <p className="font-mono text-xs text-foreground-dim">
                {formatTimestamp(current.startSeconds)} – {formatTimestamp(current.endSeconds)}
              </p>
            </div>
            <PracticePlayer
              key={current.videoId}
              songId={song.id}
              segment={{
                id: current.id,
                videoId: current.videoId,
                title: current.title,
                startSeconds: current.startSeconds,
                endSeconds: current.endSeconds,
                lastWatchedPositionSeconds: current.lastWatchedPositionSeconds,
              }}
              video={{ sourceType: current.video.sourceType, sourceRef: current.video.sourceRef }}
              navSegments={song.segments}
            />
          </div>

          <SegmentControls
            key={current.id}
            segmentId={current.id}
            initialStatus={isValidStatus(current.status) ? current.status : "not_started"}
            initialNotes={current.notes}
            transcriptExcerpt={current.transcriptExcerpt}
          />
        </div>
      )}
    </div>
  );
}
