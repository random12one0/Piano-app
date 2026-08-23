import Link from "next/link";
import { getSongsWithSegments } from "@/lib/queries";
import SegmentRail from "@/components/rail/SegmentRail";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const songs = await getSongsWithSegments();
  const flaggedTotal = songs.reduce(
    (sum, song) => sum + song.segments.filter((s) => s.status === "needs_review").length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-16 sm:px-10">
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

      {songs.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <div>
          {songs.map((song) => {
            const total = song.segments.length;
            const done = song.segments.filter((s) => s.status === "done").length;
            const flagged = song.segments.filter((s) => s.status === "needs_review").length;

            return (
              <section key={song.id} className="border-b border-rule py-10 first:pt-0 last:border-none">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Link
                    href={`/songs/${song.id}`}
                    className="font-display text-2xl text-foreground transition-colors hover:text-accent sm:text-3xl"
                  >
                    {song.title}
                  </Link>
                  <span className="font-mono text-xs text-foreground-dim">
                    {done}/{total} done
                    {flagged > 0 ? <span className="text-flag"> · {flagged} flagged</span> : null}
                  </span>
                </div>
                {song.instructorNotes && (
                  <p className="mb-6 max-w-2xl font-sans text-sm italic text-foreground-dim">
                    {song.instructorNotes}
                  </p>
                )}
                <SegmentRail songId={song.id} segments={song.segments} currentSegmentId={song.lastSegmentId} />
              </section>
            );
          })}
        </div>
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
