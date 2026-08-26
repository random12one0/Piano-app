import Link from "next/link";
import { getRecentSessions, getSongs } from "@/lib/queries";
import PracticeHeatmap from "@/components/history/PracticeHeatmap";
import SongTotals from "@/components/history/SongTotals";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const [sessions, songs] = await Promise.all([getRecentSessions(200), getSongs()]);

  const serialised = sessions.map((s) => ({
    songId: s.songId,
    endedAt: s.endedAt.toISOString(),
    secondsPracticed: s.secondsPracticed,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-[calc(3rem+env(safe-area-inset-top))] sm:px-10 sm:pt-16">
      <Link
        href="/"
        className="mb-8 inline-flex min-h-11 items-center font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
      >
        ← Library
      </Link>

      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">History</p>
        <h1 className="font-display text-4xl italic text-foreground sm:text-5xl">Time at the piano</h1>
        <span aria-hidden className="mt-4 mb-4 block h-[2px] w-16 bg-accent" />
        <p className="max-w-xl font-sans text-sm text-foreground-dim">
          Every sitting is recorded from the progress the player already saves, so nothing here needs
          starting or stopping by hand.
        </p>
      </header>

      {serialised.length === 0 ? (
        <p className="font-mono text-sm text-foreground-dim">
          Nothing recorded yet — play a segment and it&rsquo;ll show up here.
        </p>
      ) : (
        <div className="flex flex-col gap-12">
          <PracticeHeatmap sessions={serialised} />
          <SongTotals
            sessions={serialised}
            songs={songs.map((s) => ({ id: s.id, title: s.title }))}
          />
        </div>
      )}
    </div>
  );
}
