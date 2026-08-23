"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseCaptionFile, type ParsedCaptionLine } from "@/lib/captions";
import { parsePlainTimedText } from "@/lib/plainTranscript";
import { proposeChapters, type ChapterProposal } from "@/lib/chaptering";
import { createVideoWithSegments } from "@/lib/actions";
import { formatTimestamp, parseTimestampInput } from "@/lib/format";

type EditableChapter = ChapterProposal & { key: string; included: boolean };

const inputClass =
  "w-full border border-rule bg-surface px-3 py-2 font-sans text-sm text-foreground focus:border-accent focus:outline-none";

export default function IngestFlow({ songId }: { songId: string }) {
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

    const proposals = proposeChapters(parsedLines);
    setLines(parsedLines);
    setChapters(
      proposals.map((c, i) => ({ ...c, key: `${i}-${c.startSeconds}`, included: true })),
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
    const included = chapters.filter((c) => c.included);
    if (included.length === 0) {
      setError("Include at least one chapter to save.");
      return;
    }
    setError(null);
    const duration = Math.max(...lines.map((l) => l.endSeconds), 0);

    startTransition(async () => {
      await createVideoWithSegments({
        songId,
        videoTitle,
        sourceType,
        sourceRef,
        durationSeconds: duration,
        transcriptLines: lines,
        chapters: included.map((c) => ({
          title: c.title,
          startSeconds: c.startSeconds,
          endSeconds: c.endSeconds,
          transcriptExcerpt: c.transcriptExcerpt,
        })),
      });
      router.push(`/songs/${songId}`);
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
                  className="cursor-pointer font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:text-flag"
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

        {error && <p className="font-mono text-xs text-flag">{error}</p>}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStep("source")}
            className="cursor-pointer border border-rule px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground-dim transition-colors hover:border-accent hover:text-accent"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="cursor-pointer border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : `Save ${chapters.length} segments`}
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
            className={`${inputClass} resize-none font-mono text-xs`}
          />
        )}
      </div>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}

      <button
        type="button"
        onClick={handleParse}
        className="w-fit cursor-pointer border border-accent bg-accent px-4 py-2 font-mono text-xs uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90"
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
      className={`cursor-pointer border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
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
      className="w-16 border-b border-rule bg-transparent text-center focus:border-accent focus:outline-none"
    />
  );
}
