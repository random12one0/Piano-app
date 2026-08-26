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
// Media time and wall-clock time disagree once ffprobe-derived durations meet
// a browser demuxer, and browsers routinely stop a hair short of `duration`.
// Without this the loop boundary is simply never reached.
const LOOP_END_EPSILON = 0.25;

/**
 * Fire-and-forget progress write that skips page revalidation. Used for the
 * periodic save during playback and for teardown flushes — neither should
 * cost a full server re-render of the song page.
 */
function beaconProgress(segmentId: string, positionSeconds: number) {
  const payload = JSON.stringify({ segmentId, positionSeconds });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/progress", new Blob([payload], { type: "application/json" }));
    return;
  }
  fetch("/api/progress", {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

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
  const wasPlayingRef = useRef(false);
  const segmentIdRef = useRef(segment.id);
  // True once the user has actually played something on this segment. Every
  // write path is gated on it, so merely opening a song never marks it in
  // progress, never moves the resume pointer, and never overrides an
  // explicit "Not started".
  const hasPlayedRef = useRef(false);

  const startAt = hasKnownEnd
    ? Math.min(Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds), segment.endSeconds)
    : Math.max(segment.lastWatchedPositionSeconds, segment.startSeconds);

  // Updated on every tick — the source of truth for "exact position right
  // now" used by the flush paths below (pause, segment/video switch, tab
  // hide, unmount) so the resume point is never more than a tick stale.
  const currentPositionRef = useRef(startAt);

  // The parent keys this component by video id, not segment id — switching
  // to another segment of the SAME video just updates props rather than
  // remounting, so we seek to the new start here instead of reloading (and
  // pausing) the underlying player.
  useEffect(() => {
    if (mountedSegmentIdRef.current === segment.id) return;

    const previousSegmentId = mountedSegmentIdRef.current;
    if (readyRef.current && hasPlayedRef.current) {
      const previousPosition = handleRef.current?.getCurrentTime() ?? currentPositionRef.current;
      recordProgress(previousSegmentId, previousPosition).catch(() => {});
    }

    mountedSegmentIdRef.current = segment.id;
    segmentIdRef.current = segment.id;
    currentPositionRef.current = startAt;
    setLiveDuration(0);
    lastSavedTimeRef.current = 0;
    wasPlayingRef.current = false;
    // Playback state is per-segment: arriving at a new one and leaving
    // without playing must not write progress for it either.
    hasPlayedRef.current = false;
    if (readyRef.current) handleRef.current?.seekTo(startAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment.id]);

  // Cross-video switch (new key, this instance unmounts) or a client-side
  // navigation away from the song entirely — flush the exact position one
  // last time. Reads the refs at unmount time, so `[]` deps are correct
  // here even though the values they read change over the component's life.
  useEffect(() => {
    return () => {
      if (!hasPlayedRef.current) return;
      recordProgress(segmentIdRef.current, currentPositionRef.current).catch(() => {});
    };
  }, []);

  // Real tab close / app backgrounding — a normal server action isn't
  // guaranteed to finish before the page is torn down, so use sendBeacon
  // for a fire-and-forget flush that survives it.
  useEffect(() => {
    const flush = () => {
      if (!hasPlayedRef.current) return;
      beaconProgress(segmentIdRef.current, currentPositionRef.current);
    };
    const onVisibilityChange = () => {
      if (document.hidden) flush();
    };
    const onPageHide = () => flush();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

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
    currentPositionRef.current = currentTime;
    if (isPlaying) hasPlayedRef.current = true;

    if (!hasKnownEnd) {
      const d = handleRef.current?.getDuration() ?? 0;
      if (d > 0) setLiveDuration(d);
    }

    // Loop back to the segment's start. `effectiveEnd > 0` skips the window
    // where a YouTube embed hasn't reported its duration yet, which would
    // otherwise read as "already past the end" and seek on every tick.
    if (loop && effectiveEnd > 0 && currentTime >= effectiveEnd - LOOP_END_EPSILON) {
      handleRef.current?.seekTo(segment.startSeconds);
      // Reaching the true end of a video pauses it, so a bare seek would
      // rewind and sit there. Explicitly resume.
      handleRef.current?.play();
      lastSavedTimeRef.current = segment.startSeconds;
      wasPlayingRef.current = true;
      return;
    }

    // Flush immediately the moment playback stops, bypassing the throttle
    // below — otherwise a pause shortly after the last periodic save could
    // lose up to PROGRESS_SAVE_INTERVAL seconds of real progress.
    const justPaused = wasPlayingRef.current && !isPlaying;
    wasPlayingRef.current = isPlaying;

    if (!hasPlayedRef.current) return;

    if (justPaused) {
      lastSavedTimeRef.current = currentTime;
      // Pausing is a moment the rest of the page cares about (status may
      // flip to "in progress"), so this one revalidates.
      recordProgress(segment.id, currentTime).catch(() => {});
      return;
    }

    if (isPlaying && Math.abs(currentTime - lastSavedTimeRef.current) >= PROGRESS_SAVE_INTERVAL) {
      lastSavedTimeRef.current = currentTime;
      // Mid-playback: write without revalidating. Re-rendering the song page
      // every few seconds during a video is pure waste.
      beaconProgress(segment.id, currentTime);
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

      <div className="h-px w-full bg-rule/50" aria-hidden />

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
        <div className="border-t border-rule/50 pt-3">
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
