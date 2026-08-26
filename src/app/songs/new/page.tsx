import Link from "next/link";
import NewSongForm from "@/components/NewSongForm";
import { EYEBROW } from "@/lib/ui";

export default function NewSongPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-10 sm:pt-12">
      <Link
        href="/"
        className="mb-8 inline-block font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim transition-colors hover:text-accent"
      >
        ← Library
      </Link>

      <header className="mb-10">
        <p className={`mb-2 ${EYEBROW} text-accent`}>New song</p>
        <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">
          What are you learning?
        </h1>
        <span aria-hidden className="mt-4 block h-[2px] w-16 bg-accent" />
      </header>

      <NewSongForm />
    </div>
  );
}
