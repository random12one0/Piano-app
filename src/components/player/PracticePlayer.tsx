"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { recordProgress } from "@/lib/actions";
import { formatTimestamp } from "@/lib/format";
import SegmentMarker from "@/components/rail/SegmentMarker";
import { videoLabel } from "@/components/rail/SegmentRail";
import { isValidStatus } from "@/lib/status";
import type { PlayerHandle } from "./types";

const YouTubePlayer = dynamic(() => import("./YouTubePlayer"), { ssr: false });
const LocalVideoPlayer = dynamic(() => import("./LocalVideoPlayer"), { ssr: false });

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const PROGRESS_SAVE_INTERVAL = 5;

export type PracticePlayerSegment = {
  id: string;
  videoId: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  lastWatchedPositionSeconds: number;
};

export type PracticePlayerVideo = {
  sourceType: string;
  sourceRef: string;
};

export type PracticePlayerNavSegment = {
  id: string;
  title: string;
  status: string;
  videoId: string;
  video: { title: string };
};

export default function PracticePlayer({
  songId,
  segment,
  video,
  navSegments,
}: {
  songId: string;
  segment: PracticePlayerSegment;
  video: PracticePlayerVideo;
  navSegments: PracticePlayerNavSegment[];
}) {
  const handleRef = useRef<PlayerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(
    Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds),
  );
  // Some sources (a YouTube video we've never probed) don't have a known
  // duration in the DB yet — endSeconds is stored as 0 as a sentinel. In
  // that case we fall back to whatever the embedded player itself reports
  // once it loads, rather than pretending we know the real end time.
  const hasKnownEnd = segment.endSeconds > segment.startSeconds;
  const [liveDuration, setLiveDuration] = useState(0);
  const effectiveEnd = hasKnownEnd ? segment.endSeconds : liveDuration;
  const lastSavedTimeRef = useRef(0);
  const readyRef = useRef(false);
  const mountedSegmentIdRef = useRef(segment.id);

  const startAt = hasKnownEnd
    ? Math.min(Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds), segment.endSeconds)
    : Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds);

  // The parent keys this component by video id, not segment id — switching
  // to another segment of the SAME video just updates props rather than
  // remounting, so we seek to the new start here instead of reloading (and
  // pausing) the underlying player.
  useEffect(() => {
    if (mountedSegmentIdRef.current === segment.id) return;
    mountedSegmentIdRef.current = segment.id;
    setLiveDuration(0);
    setElapsed(startAt);
    lastSavedTimeRef.current = 0;
    if (readyRef.current) handleRef.current?.seekTo(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  function handleReady() {
    readyRef.current = true;
    handleRef.current?.setPlaybackRate(speed);
    if (!hasKnownEnd) setLiveDuration(handleRef.current?.getDuration() ?? 0);
  }

  function handleTick(currentTime: number, isPlaying: boolean) {
    setElapsed(currentTime);
    if (!hasKnownEnd) {
      const d = handleRef.current?.getDuration() ?? 0;
      if (d > 0) setLiveDuration(d);
    }

    if (loop && effectiveEnd > 0 && currentTime >= effectiveEnd) {
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
    Math.max(0, ((elapsed - segment.startSeconds) / Math.max(1, effectiveEnd - segment.startSeconds)) * 100),
  );

  const currentIndex = navSegments.findIndex((s) => s.id === segment.id);
  const prevSegment = currentIndex > 0 ? navSegments[currentIndex - 1] : null;
  const nextSegment =
    currentIndex >= 0 && currentIndex < navSegments.length - 1 ? navSegments[currentIndex + 1] : null;

  const sameVideoSegments = navSegments.filter((s) => s.videoId === segment.videoId);
  const videoIds = [...new Set(navSegments.map((s) => s.videoId))];
  const videoIndex = videoIds.indexOf(segment.videoId);
  const prevVideoFirst =
    videoIndex > 0 ? navSegments.find((s) => s.videoId === videoIds[videoIndex - 1]) ?? null : null;
  const nextVideoFirst =
    videoIndex >= 0 && videoIndex < videoIds.length - 1
      ? navSegments.find((s) => s.videoId === videoIds[videoIndex + 1]) ?? null
      : null;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "flex h-full flex-col justify-center gap-2 overflow-y-auto bg-background p-3 sm:gap-3 sm:p-5"
          : "flex flex-col gap-3"
      }
    >
      <div
        className={`w-full overflow-hidden bg-black ${isFullscreen ? "aspect-video max-h-[60vh] shrink-0" : "aspect-video"}`}
      >
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
          <span>{effectiveEnd > 0 ? formatTimestamp(effectiveEnd) : "…"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
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

          <button
            type="button"
            onClick={toggleFullscreen}
            className="cursor-pointer uppercase tracking-wide text-foreground-dim transition-colors hover:text-accent"
          >
            {isFullscreen ? "⤡ Exit fullscreen" : "⤢ Fullscreen"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 font-mono text-xs uppercase tracking-wide">
        {prevSegment ? (
          <Link
            href={`/songs/${songId}?segment=${prevSegment.id}`}
            className="min-w-0 truncate text-foreground-dim transition-colors hover:text-accent"
          >
            ← {prevSegment.title}
          </Link>
        ) : (
          <span />
        )}
        {nextSegment ? (
          <Link
            href={`/songs/${songId}?segment=${nextSegment.id}`}
            className="min-w-0 truncate text-right text-foreground-dim transition-colors hover:text-accent"
          >
            {nextSegment.title} →
          </Link>
        ) : (
          <span />
        )}
      </div>

      {isFullscreen && (sameVideoSegments.length > 1 || prevVideoFirst || nextVideoFirst) && (
        <div className="border-t border-rule pt-3">
          <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-foreground-dim/70">
            <span className="truncate">
              {sameVideoSegments[0] ? videoLabel(sameVideoSegments[0].video.title) : ""}
            </span>
            <div className="flex shrink-0 items-center gap-4">
              {prevVideoFirst && (
                <Link
                  href={`/songs/${songId}?segment=${prevVideoFirst.id}`}
                  className="transition-colors hover:text-accent"
                >
                  ← Prev part
                </Link>
              )}
              {nextVideoFirst && (
                <Link
                  href={`/songs/${songId}?segment=${nextVideoFirst.id}`}
                  className="transition-colors hover:text-accent"
                >
                  Next part →
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {sameVideoSegments.map((s) => {
              const status = isValidStatus(s.status) ? s.status : "not_started";
              return (
                <Link
                  key={s.id}
                  href={`/songs/${songId}?segment=${s.id}`}
                  className="group shrink-0"
                  title={`${s.title} — ${status.replace("_", " ")}`}
                >
                  <SegmentMarker status={status} isCurrent={s.id === segment.id} size={8} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
