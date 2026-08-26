import Link from "next/link";
import { notFound } from "next/navigation";
import { getSongWithSegments } from "@/lib/queries";
import PracticeSurface from "@/components/practice/PracticeSurface";
import SongMenu from "@/components/practice/SongMenu";
import { isValidStatus } from "@/lib/status";
import { mediaUrl } from "@/lib/media";

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

  // Project before crossing the client boundary — the raw rows carry every
  // column of all of a song's segments plus a full joined video each.
  const listSegments = song.segments.map((s) => ({
    id: s.id,
    title: s.title,
    status: s.status,
    videoId: s.videoId,
    startSeconds: s.startSeconds,
    endSeconds: s.endSeconds,
    video: { title: s.video.title },
  }));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-10 sm:pb-24">
      {/* Everything you need at a glance in one 44px row, so the video is the
          first thing on screen rather than the fifth. */}
      <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-rule/60 bg-background px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:-mx-10 sm:px-10">
        <Link
          href="/"
          aria-label="Back to library"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center font-mono text-sm text-foreground-dim transition-colors hover:text-accent"
        >
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-lg italic text-foreground sm:text-xl">
          {song.title}
        </h1>
        <SongMenu
          songId={song.id}
          sheetMusicUrl={song.sheetMusicKey ? mediaUrl(song.sheetMusicKey) : null}
        />
      </header>

      {song.instructorNotes && (
        <p className="mb-5 max-w-2xl font-sans text-sm italic text-foreground-dim">
          {song.instructorNotes}
        </p>
      )}

      {!current ? (
        <p className="font-mono text-sm text-foreground-dim">
          No segments yet.{" "}
          <Link href={`/songs/${song.id}/ingest`} className="text-accent underline underline-offset-4">
            Ingest a lesson video
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <PracticeSurface
          songId={song.id}
          segments={listSegments}
          current={{
            id: current.id,
            videoId: current.videoId,
            title: current.title,
            status: isValidStatus(current.status) ? current.status : "not_started",
            notes: current.notes,
            transcriptExcerpt: current.transcriptExcerpt,
            startSeconds: current.startSeconds,
            endSeconds: current.endSeconds,
            lastWatchedPositionSeconds: current.lastWatchedPositionSeconds,
            video: {
              title: current.video.title,
              sourceType: current.video.sourceType,
              sourceRef: current.video.sourceRef,
            },
          }}
        />
      )}
    </div>
  );
}
