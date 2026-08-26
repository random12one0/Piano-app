"use client";

import Link from "next/link";
import { useEffect } from "react";
import { EYEBROW } from "@/lib/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-24 sm:px-10">
      <p className={`mb-2 ${EYEBROW} text-flag`}>Something broke</p>
      <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">
        That didn&rsquo;t load.
      </h1>
      <span aria-hidden className="mt-4 mb-4 block h-[2px] w-16 bg-accent" />
      <p className="max-w-md font-sans text-base text-foreground-dim">
        Usually a dropped connection to the database. Your practice progress is saved as you go, so
        nothing should be lost.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-foreground-dim/70">Reference: {error.digest}</p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 cursor-pointer items-center border border-accent bg-accent px-4 font-mono text-xs font-medium uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center border border-rule px-4 font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim transition-colors hover:border-accent hover:text-accent"
        >
          ← Library
        </Link>
      </div>
    </div>
  );
}
