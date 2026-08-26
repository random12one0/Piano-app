"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSong } from "@/lib/actions";
import { BUTTON_ACCENT, INPUT, LABEL } from "@/lib/ui";

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
        <span className={LABEL}>Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. River Flows in You"
          autoFocus
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>
          Instructor notes (optional)
        </span>
        <textarea
          value={instructorNotes}
          onChange={(e) => setInstructorNotes(e.target.value)}
          placeholder="Arrangement, difficulty, teaching approach…"
          rows={3}
          className={`resize-none ${INPUT}`}
        />
      </label>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className={`w-fit ${BUTTON_ACCENT}`}
      >
        {isPending ? "Creating…" : "Create & add first video"}
      </button>
    </form>
  );
}
