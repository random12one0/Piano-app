"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCaptionFile, type ParsedCaptionLine } from "@/lib/captions";
import { parsePlainTimedText } from "@/lib/plainTranscript";
import { proposeChapters, type ChapterProposal } from "@/lib/chaptering";
import { createVideoWithSegments } from "@/lib/actions";
import { formatTimestamp, parseTimestampInput } from "@/lib/format";

type EditableChapter = ChapterProposal & { key: string };

const inputClass =
  "min-h-11 w-full border border-rule bg-surface px-3 py-2 font-sans text-base text-foreground focus:border-accent focus:outline-none";

export type ExistingPart = { videoId: string; title: string; sourceRef: string };

export default function IngestFlow({
  songId,
  existingParts = [],
}: {
  songId: string;
  existingParts?: ExistingPart[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"source" | "review">("source");
  const [isPending, startTransition] = useTransition();

  const [videoTitle, setVideoTitle] = useState("");
  const [sourceType, setSourceType] = useState<"youtube" | "local">("youtube");
  const [sourceRef, setSourceRef] = useState("");
  const [captionMode, setCaptionMode] = useState<"file" | "paste">("file");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<ParsedCaptionLine[]>([]);
  const [chapters, setChapters] = useState<EditableChapter[]>([]);
  // "" means append as a new part. Anything else replaces that part in place.
  const [replaceVideoId, setReplaceVideoId] = useState("");

  async function handleParse() {
    setError(null);
    if (!videoTitle.trim() || !sourceRef.trim()) {
      setError("Video title and source are required.");
      return;
    }

    let parsedLines: ParsedCaptionLine[] = [];
    try {
      if (captionMode === "file") {
        const file = fileInputRef.current?.files?.[0];
        if (!file) {
          setError("Choose a .srt or .vtt file.");
          return;
        }
        const text = await file.text();
        parsedLines = parseCaptionFile(file.name, text);
      } else {
        if (!pasteText.trim()) {
          setError("Paste a timestamped transcript first.");
          return;
        }
        parsedLines = parsePlainTimedText(pasteText);
      }
    } catch {
      setError("Could not parse that transcript. Check the format and try again.");
      return;
    }

    if (parsedLines.length === 0) {
      setError("No timestamped lines found in that input.");
      return;
    }

    // Re-ingesting the same source used to silently append a duplicate part.
    // Default to replacing the one that's already here.
    const match = existingParts.find((p) => p.sourceRef === sourceRef.trim());
    if (match && !replaceVideoId) setReplaceVideoId(match.videoId);

    const proposals = proposeChapters(parsedLines);
    setLines(parsedLines);
    setChapters(
      proposals.map((c, i) => ({ ...c, key: `${i}-${c.startSeconds}` })),
    );
    setStep("review");
  }

  function updateChapter(key: string, patch: Partial<EditableChapter>) {
    setChapters((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeChapter(key: string) {
    setChapters((prev) => prev.filter((c) => c.key !== key));
  }

  function handleSave() {
    if (chapters.length === 0) {
      setError("Keep at least one chapter to save.");
      return;
    }

    // Boundaries have to be sane before they reach the DB: a segment with
    // end <= start reads downstream as "duration unknown" and makes the
    // player treat the whole video as one segment, which quietly breaks
    // looping and the resume clamp.
    const invalid = chapters.find((c) => !(c.endSeconds > c.startSeconds));
    if (invalid) {
      setError(`"${invalid.title || "Untitled chapter"}" ends at or before it starts.`);
      return;
    }

    setError(null);
    const duration = Math.max(...lines.map((l) => l.endSeconds), 0);

    startTransition(async () => {
      try {
        await createVideoWithSegments({
          songId,
          videoTitle,
          sourceType,
          sourceRef,
          durationSeconds: duration,
          transcriptLines: lines,
          replaceVideoId: replaceVideoId || undefined,
          chapters: chapters.map((c) => ({
            title: c.title,
            startSeconds: c.startSeconds,
            endSeconds: c.endSeconds,
            transcriptExcerpt: c.transcriptExcerpt,
          })),
        });
        router.push(`/songs/${songId}`);
      } catch {
        // Keep the review step mounted — every hand-edited title and
        // boundary lives in local state and would be lost on a crash.
        setError("Couldn't save. Your edits are still here — try again.");
      }
    });
  }

  if (step === "review") {
    return (
      <div className="flex flex-col gap-8">
        <p className="font-mono text-xs text-foreground-dim">
          {lines.length} transcript lines parsed · {chapters.length} chapters proposed. Edit titles and
          boundaries, remove anything wrong, then save.
        </p>

        <div className="flex flex-col gap-4">
          {chapters.map((chapter) => (
            <div key={chapter.key} className="border border-rule bg-surface p-4">
              <div className="mb-3 flex items-center gap-3">
                <input
                  type="text"
                  value={chapter.title}
                  onChange={(e) => updateChapter(chapter.key, { title: e.target.value })}
                  className="flex-1 border-b border-rule bg-transparent font-display text-lg text-foreground focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeChapter(chapter.key)}
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center px-2 font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-flag"
                >
                  Remove
                </button>
              </div>
              <div className="mb-2 flex items-center gap-3 font-mono text-xs text-foreground-dim">
                <TimeField
                  value={chapter.startSeconds}
                  onChange={(v) => updateChapter(chapter.key, { startSeconds: v })}
                />
                <span>–</span>
                <TimeField
                  value={chapter.endSeconds}
                  onChange={(v) => updateChapter(chapter.key, { endSeconds: v })}
                />
              </div>
              <p className="line-clamp-2 font-sans text-sm italic text-foreground-dim">
                &ldquo;{chapter.transcriptExcerpt}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {existingParts.length > 0 && (
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
              Save as
            </span>
            <select
              value={replaceVideoId}
              onChange={(e) => setReplaceVideoId(e.target.value)}
              className={inputClass}
            >
              <option value="">A new part at the end of the song</option>
              {existingParts.map((part) => (
                <option key={part.videoId} value={part.videoId}>
                  Replace &ldquo;{part.title}&rdquo;
                </option>
              ))}
            </select>
            {replaceVideoId && (
              <span className="font-mono text-xs text-flag">
                The old part&rsquo;s segments, notes, and progress are removed.
              </span>
            )}
          </label>
        )}

        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStep("source")}
            className="inline-flex min-h-11 cursor-pointer items-center border border-rule px-4 font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:border-accent hover:text-accent"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="inline-flex min-h-11 cursor-pointer items-center border border-accent bg-accent px-4 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending
              ? "Saving…"
              : replaceVideoId
                ? `Replace part with ${chapters.length} segments`
                : `Save ${chapters.length} segments`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Field label="Video title">
        <input
          type="text"
          value={videoTitle}
          onChange={(e) => setVideoTitle(e.target.value)}
          placeholder="e.g. River Flows in You — Part 1: Right Hand"
          className={inputClass}
        />
      </Field>

      <div className="flex gap-6">
        <Field label="Source">
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as "youtube" | "local")}
            className={inputClass}
          >
            <option value="youtube">YouTube</option>
            <option value="local">Local file</option>
          </select>
        </Field>
        <Field label={sourceType === "youtube" ? "YouTube video ID" : "File path or URL"} grow>
          <input
            type="text"
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder={sourceType === "youtube" ? "dQw4w9WgXcQ" : "/videos/lesson-1.mp4"}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Captions</p>
        <div className="mb-3 flex gap-2">
          <ModeButton active={captionMode === "file"} onClick={() => setCaptionMode("file")}>
            Upload .srt / .vtt
          </ModeButton>
          <ModeButton active={captionMode === "paste"} onClick={() => setCaptionMode("paste")}>
            Paste transcript
          </ModeButton>
        </div>
        {captionMode === "file" ? (
          <input ref={fileInputRef} type="file" accept=".srt,.vtt" className={inputClass} />
        ) : (
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"0:00 So today we're going to break this down…\n0:12 First let's look at the right hand…"}
            rows={6}
            className={`${inputClass} resize-none font-mono text-base`}
          />
        )}
      </div>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <button
        type="button"
        onClick={handleParse}
        className="inline-flex min-h-11 w-fit cursor-pointer items-center border border-accent bg-accent px-4 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90"
      >
        Parse &amp; propose chapters
      </button>
    </div>
  );
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label className={`flex flex-col gap-2 ${grow ? "flex-1" : ""}`}>
      <span className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">{label}</span>
      {children}
    </label>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 cursor-pointer items-center border px-3 font-mono text-xs uppercase tracking-wide transition-colors ${
        active
          ? "border-accent bg-accent text-accent-contrast"
          : "border-rule text-foreground-dim hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}

function TimeField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(formatTimestamp(value));

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseTimestampInput(text);
        if (parsed !== null) {
          onChange(parsed);
          setText(formatTimestamp(parsed));
        } else {
          setText(formatTimestamp(value));
        }
      }}
      className="min-h-11 w-20 border-b border-rule bg-transparent text-center font-mono text-base tabular-nums focus:border-accent focus:outline-none"
    />
  );
}
