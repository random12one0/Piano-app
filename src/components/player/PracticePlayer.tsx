"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { recordProgress } from "@/lib/actions";
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
  // "expanded" is our own full-viewport overlay, not the native Fullscreen
  // API — iOS Safari doesn't support requestFullscreen() on plain elements
  // (only on <video> itself), so relying on it alone left the button dead
  // on phones. We always show the overlay; requestFullscreen() is layered
  // on top as a best-effort extra (hides browser chrome) where it works.
  const [expanded, setExpanded] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speed, setSpeed] = useState(1);
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
    lastSavedTimeRef.current = 0;
    if (readyRef.current) handleRef.current?.seekTo(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id]);

  // Lock page scroll behind the overlay while expanded.
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  // If the browser does support real fullscreen and the user backs out of
  // it (native Escape, swipe, etc.), collapse our overlay to match.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  function enterExpanded() {
    setExpanded(true);
    containerRef.current?.requestFullscreen?.().catch(() => {});
  }

  function exitExpanded() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setExpanded(false);
  }

  function handleReady() {
    readyRef.current = true;
    handleRef.current?.setPlaybackRate(speed);
    if (!hasKnownEnd) setLiveDuration(handleRef.current?.getDuration() ?? 0);
  }

  function handleTick(currentTime: number, isPlaying: boolean) {
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
        expanded
          ? "fixed inset-0 z-50 flex flex-col gap-2 overflow-y-auto bg-background p-2 sm:gap-3 sm:p-4"
          : "flex flex-col gap-3"
      }
    >
      {expanded && (
        <button
          type="button"
          onClick={exitExpanded}
          className="cursor-pointer self-end font-mono text-xs uppercase tracking-wide text-foreground-dim transition-colors hover:text-accent"
        >
          ✕ Close
        </button>
      )}

      <div
        className={`w-full overflow-hidden bg-black ${expanded ? "aspect-video max-h-[72vh] shrink-0" : "aspect-video"}`}
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

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-mono text-xs text-foreground-dim">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={jumpToStart}
            className="cursor-pointer uppercase tracking-wide text-foreground-dim transition-colors hover:text-accent"
          >
            ⟲ Start
          </button>

          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            aria-pressed={loop}
            className={`cursor-pointer uppercase tracking-wide transition-colors ${
              loop ? "text-accent" : "text-foreground-dim hover:text-accent"
            }`}
          >
            {loop ? "◉ Loop" : "◎ Loop"}
          </button>
        </div>

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

      {!expanded && (
        <button
          type="button"
          onClick={enterExpanded}
          className="w-full cursor-pointer border border-rule py-2 text-center font-mono text-xs uppercase tracking-wide text-foreground-dim transition-colors hover:border-accent hover:text-accent sm:w-auto sm:self-start sm:px-4"
        >
          ⤢ Fullscreen
        </button>
      )}

      {expanded && (sameVideoSegments.length > 1 || prevVideoFirst || nextVideoFirst) && (
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
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3">
            {sameVideoSegments.map((s) => {
              const status = isValidStatus(s.status) ? s.status : "not_started";
              return (
                <Link
                  key={s.id}
                  href={`/songs/${songId}?segment=${s.id}`}
                  className="group relative shrink-0 p-1.5"
                  title={`${s.title} — ${status.replace("_", " ")}`}
                >
                  <span className="absolute -inset-1.5" aria-hidden />
                  <SegmentMarker status={status} isCurrent={s.id === segment.id} size={10} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
