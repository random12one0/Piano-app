import Link from "next/link";
import { getSongsWithSegments } from "@/lib/queries";
import LibraryList, { type LibrarySong } from "@/components/library/LibraryList";

export const dynamic = "force-dynamic";

function youtubeThumbnail(sourceType: string, sourceRef: string): string | null {
  return sourceType === "youtube" ? `https://img.youtube.com/vi/${sourceRef}/mqdefault.jpg` : null;
}

export default async function LibraryPage() {
  const songs = await getSongsWithSegments();
  const flaggedTotal = songs.reduce(
    (sum, song) => sum + song.segments.filter((s) => s.status === "needs_review").length,
    0,
  );

  const librarySongs: LibrarySong[] = songs.map((song) => {
    const firstVideo = song.segments[0]?.video;
    return {
      id: song.id,
      title: song.title,
      instructorNotes: song.instructorNotes,
      lastSegmentId: song.lastSegmentId,
      thumbnailUrl: firstVideo ? youtubeThumbnail(firstVideo.sourceType, firstVideo.sourceRef) : null,
      segments: song.segments,
    };
  });

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-16 sm:px-10">
      <header className="mb-16 flex items-baseline justify-between border-b border-rule pb-8">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">Practice Rail</p>
          <h1 className="font-display text-4xl italic text-foreground sm:text-5xl">
            Your lesson library
          </h1>
        </div>
        <nav className="flex items-center gap-6 font-mono text-xs uppercase tracking-wider">
          <Link href="/review" className="text-foreground-dim transition-colors hover:text-flag">
            Review queue{flaggedTotal > 0 ? ` (${flaggedTotal})` : ""}
          </Link>
          <Link href="/songs/new" className="text-foreground-dim transition-colors hover:text-accent">
            + New song
          </Link>
        </nav>
      </header>

      {librarySongs.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <LibraryList songs={librarySongs} />
      )}
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="border border-dashed border-rule px-8 py-16 text-center">
      <p className="font-display text-xl italic text-foreground-dim">The rail is empty.</p>
      <p className="mt-3 font-sans text-sm text-foreground-dim">
        Add a song, then ingest a lesson video&rsquo;s captions to auto-chapter it.
      </p>
      <Link
        href="/songs/new"
        className="mt-6 inline-block border border-accent px-4 py-2 font-mono text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-accent-contrast"
      >
        + New song
      </Link>
    </div>
  );
}
