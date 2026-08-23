import Link from "next/link";
import { notFound } from "next/navigation";
import { getSongWithSegments } from "@/lib/queries";
import IngestFlow from "@/components/ingest/IngestFlow";

export const dynamic = "force-dynamic";

export default async function IngestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const song = await getSongWithSegments(id);
  if (!song) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-12 sm:px-10">
      <Link
        href={`/songs/${song.id}`}
        className="mb-8 inline-block font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
      >
        ← {song.title}
      </Link>

      <header className="mb-10 border-b border-rule pb-8">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">Ingest a lesson video</p>
        <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">{song.title}</h1>
        <p className="mt-3 max-w-xl font-sans text-sm text-foreground-dim">
          Provide a source video and its captions. Chapters are proposed automatically from natural
          breaks in the transcript — review and edit them before they&rsquo;re saved.
        </p>
      </header>

      <IngestFlow songId={song.id} />
    </div>
  );
}
