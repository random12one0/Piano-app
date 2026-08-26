import Link from "next/link";
import { EYEBROW } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-24 sm:px-10">
      <p className={`mb-2 ${EYEBROW} text-accent`}>Not found</p>
      <h1 className="font-display text-3xl italic text-foreground sm:text-4xl">
        That page isn&rsquo;t here.
      </h1>
      <span aria-hidden className="mt-4 mb-4 block h-[2px] w-16 bg-accent" />
      <p className="max-w-md font-sans text-base text-foreground-dim">
        The song or lesson you were looking for may have been renamed or removed.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 w-fit items-center border border-accent px-4 font-mono text-xs font-medium uppercase tracking-wider text-accent transition-colors hover:bg-accent hover:text-accent-contrast"
      >
        ← Back to library
      </Link>
    </div>
  );
}
