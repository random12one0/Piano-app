"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSong } from "@/lib/actions";

export default function NewSongForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [instructorNotes, setInstructorNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the song a title.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const { id } = await createSong({ title, instructorNotes });
      router.push(`/songs/${id}/ingest`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. River Flows in You"
          autoFocus
          className="w-full border border-rule bg-surface px-3 py-2 font-sans text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
          Instructor notes (optional)
        </span>
        <textarea
          value={instructorNotes}
          onChange={(e) => setInstructorNotes(e.target.value)}
          placeholder="Arrangement, difficulty, teaching approach…"
          rows={3}
          className="w-full resize-none border border-rule bg-surface px-3 py-2 font-sans text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-fit cursor-pointer border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create & add first video"}
      </button>
    </form>
  );
}
