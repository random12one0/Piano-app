import Link from "next/link";
import NewSongForm from "@/components/NewSongForm";

export default function NewSongPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-12 sm:px-10">
      <Link
        href="/"
        className="mb-8 inline-block font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
      >
        ← Library
      </Link>

      <header className="mb-10">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-accent">New song</p>
        <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">
          What are you learning?
        </h1>
        <span aria-hidden className="mt-4 block h-[2px] w-16 bg-accent" />
      </header>

      <NewSongForm />
    </div>
  );
}
