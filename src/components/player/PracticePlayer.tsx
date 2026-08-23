"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { recordProgress } from "@/lib/actions";
import { formatTimestamp } from "@/lib/format";
import type { PlayerHandle } from "./types";

const YouTubePlayer = dynamic(() => import("./YouTubePlayer"), { ssr: false });
const LocalVideoPlayer = dynamic(() => import("./LocalVideoPlayer"), { ssr: false });

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const PROGRESS_SAVE_INTERVAL = 5;

export type PracticePlayerSegment = {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  lastWatchedPositionSeconds: number;
};

export type PracticePlayerVideo = {
  sourceType: string;
  sourceRef: string;
};

export default function PracticePlayer({
  segment,
  video,
}: {
  segment: PracticePlayerSegment;
  video: PracticePlayerVideo;
}) {
  const handleRef = useRef<PlayerHandle>(null);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(
    Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds),
  );
  const lastSavedTimeRef = useRef(0);
  const readyRef = useRef(false);

  const startAt = Math.min(
    Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds),
    segment.endSeconds,
  );

  // The parent renders this component with key={segment.id}, so a new
  // segment remounts it fresh rather than needing an effect to reset state.

  function handleReady() {
    readyRef.current = true;
    handleRef.current?.setPlaybackRate(speed);
  }

  function handleTick(currentTime: number, isPlaying: boolean) {
    setElapsed(currentTime);

    if (loop && currentTime >= segment.endSeconds) {
      handleRef.current?.seekTo(segment.startSeconds);
      return;
    }

    if (isPlaying && Math.abs(currentTime - lastSavedTimeRef.current) >= PROGRESS_SAVE_INTERVAL) {
      lastSavedTimeRef.current = currentTime;
      recordProgress(segment.id, currentTime);
    }
  }

  function handleSpeedChange(next: number) {
    setSpeed(next);
    handleRef.current?.setPlaybackRate(next);
  }

  function jumpToStart() {
    handleRef.current?.seekTo(segment.startSeconds);
  }

  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((elapsed - segment.startSeconds) / Math.max(1, segment.endSeconds - segment.startSeconds)) * 100,
    ),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-video w-full overflow-hidden bg-black">
        {video.sourceType === "youtube" ? (
          <YouTubePlayer
            ref={handleRef}
            sourceRef={video.sourceRef}
            startAt={startAt}
            onReady={handleReady}
            onTick={handleTick}
          />
        ) : (
          <LocalVideoPlayer
            ref={handleRef}
            sourceRef={video.sourceRef}
            startAt={startAt}
            onReady={handleReady}
            onTick={handleTick}
          />
        )}
      </div>

      <div className="h-px w-full bg-rule" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-foreground-dim">
        <div className="flex items-center gap-2">
          <span>{formatTimestamp(elapsed)}</span>
          <div className="relative h-1 w-32 bg-surface-raised">
            <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${progressPct}%` }} />
          </div>
          <span>{formatTimestamp(segment.endSeconds)}</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={jumpToStart}
            className="cursor-pointer uppercase tracking-wide text-foreground-dim transition-colors hover:text-accent"
          >
            ⟲ Segment start
          </button>

          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            aria-pressed={loop}
            className={`cursor-pointer uppercase tracking-wide transition-colors ${
              loop ? "text-accent" : "text-foreground-dim hover:text-accent"
            }`}
          >
            {loop ? "◉ Looping segment" : "◎ Loop segment"}
          </button>

          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeedChange(s)}
                className={`cursor-pointer px-1.5 py-0.5 transition-colors ${
                  speed === s ? "bg-accent text-accent-contrast" : "text-foreground-dim hover:text-accent"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
