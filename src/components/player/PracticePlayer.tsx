"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recordProgress } from "@/lib/actions";
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
  videoId: string;
};

export default function PracticePlayer({
  songId,
  segment,
  video,
  navSegments,
  nowPlaying,
  statusControls,
  positionRef,
  expanded,
  onExpandedChange,
  onToggleDone,
}: {
  songId: string;
  segment: PracticePlayerSegment;
  video: PracticePlayerVideo;
  navSegments: PracticePlayerNavSegment[];
  /** Rendered directly under the video, in both inline and fullscreen modes. */
  nowPlaying?: ReactNode;
  /**
   * Done / Flag, rendered inside the control bar rather than in a sibling
   * panel — so they're reachable in fullscreen, which is the mode you're
   * actually in when you're sitting at the piano.
   */
  statusControls?: ReactNode;
  /**
   * Mirror of the live playhead, for callers that need it on demand (the
   * segment editor's "split here") without re-rendering on every tick.
   */
  positionRef?: { current: number };
  /**
   * Fullscreen lives in the parent, above the boundary this component is
   * keyed by video id — otherwise stepping from the last segment of one part
   * to the first of the next remounts the player and silently drops you out
   * of fullscreen mid-practice.
   */
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  /** Keyboard `D`. Omitted when the surface has no status to toggle. */
  onToggleDone?: () => void;
}) {
  const router = useRouter();
  const handleRef = useRef<PlayerHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // "expanded" is our own full-viewport overlay, not the native Fullscreen
  // API — iOS Safari doesn't support requestFullscreen() on plain elements
  // (only on <video> itself), so relying on it alone left the button dead
  // on phones. We always show the overlay; requestFullscreen() is layered
  // on top as a best-effort extra (hides browser chrome) where it works.
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
  const isPlayingRef = useRef(false);
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

  // Native fullscreen is a best-effort layer on top of our own overlay, and
  // only some browsers grant it. `nativeRef` records whether *this* instance
  // actually got it, so a remount (stepping into the next part re-keys the
  // player) can't be mistaken for the user backing out.
  const nativeRef = useRef(false);
  const expandedChangeRef = useRef(onExpandedChange);
  useEffect(() => {
    expandedChangeRef.current = onExpandedChange;
  });

  useEffect(() => {
    let alive = true;
    const onFsChange = () => {
      if (!alive || document.fullscreenElement || !nativeRef.current) return;
      // The user left native fullscreen (Escape, swipe down) — match it.
      nativeRef.current = false;
      expandedChangeRef.current(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      alive = false;
      nativeRef.current = false;
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, []);

  // Drive the native layer from the (parent-owned) expanded flag, so a
  // cross-part step that remounts this component re-enters fullscreen rather
  // than dumping you back to the page. Transient user activation outlives the
  // click that set the flag, so the request still succeeds here.
  useEffect(() => {
    const el = containerRef.current;
    if (expanded) {
      if (!document.fullscreenElement && el?.requestFullscreen) {
        el.requestFullscreen()
          .then(() => {
            nativeRef.current = true;
          })
          .catch(() => {});
      }
    } else if (document.fullscreenElement && nativeRef.current) {
      nativeRef.current = false;
      document.exitFullscreen().catch(() => {});
    }
  }, [expanded]);

  const index = navSegments.findIndex((s) => s.id === segment.id);
  const prevSegment = index > 0 ? navSegments[index - 1] : null;
  const nextSegment = index >= 0 && index < navSegments.length - 1 ? navSegments[index + 1] : null;

  function enterExpanded() {
    onExpandedChange(true);
  }

  function exitExpanded() {
    onExpandedChange(false);
  }

  function nudgeSpeed(direction: -1 | 1) {
    const i = SPEEDS.indexOf(speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? 2 : i) + direction))];
    handleSpeedChange(next);
  }

  // Keyboard transport. Everything the control bar does, without reaching for
  // the mouse — worth having at a desk, and it's how Escape leaves fullscreen.
  // Mirrored through a ref so the listener never goes stale.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => {});
  const onShortcut = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        if (isPlayingRef.current) handleRef.current?.pause();
        else handleRef.current?.play();
        break;
      case "ArrowLeft":
        if (prevSegment) {
          e.preventDefault();
          router.push(`/songs/${songId}?segment=${prevSegment.id}`);
        }
        break;
      case "ArrowRight":
        if (nextSegment) {
          e.preventDefault();
          router.push(`/songs/${songId}?segment=${nextSegment.id}`);
        }
        break;
      case "l":
      case "L":
        setLoop((v) => !v);
        break;
      case "[":
        nudgeSpeed(-1);
        break;
      case "]":
        nudgeSpeed(1);
        break;
      case "f":
      case "F":
        if (expanded) exitExpanded();
        else enterExpanded();
        break;
      case "d":
      case "D":
        onToggleDone?.();
        break;
      case "Escape":
        if (expanded) exitExpanded();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    shortcutRef.current = onShortcut;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => shortcutRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleReady() {
    readyRef.current = true;
    handleRef.current?.setPlaybackRate(speed);
    if (!hasKnownEnd) setLiveDuration(handleRef.current?.getDuration() ?? 0);
  }

  function handleTick(currentTime: number, isPlaying: boolean) {
    currentPositionRef.current = currentTime;
    if (positionRef) positionRef.current = currentTime;
    isPlayingRef.current = isPlaying;
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

  const iconButton =
    "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border border-rule px-3 font-medium uppercase tracking-wide transition-colors hover:border-accent hover:text-accent";

  const controlBar = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 font-mono text-xs text-foreground-dim">
      <button type="button" onClick={jumpToStart} title="Back to the start of this segment" className={iconButton}>
        ⟲ Start
      </button>

      <button
        type="button"
        onClick={() => setLoop((v) => !v)}
        aria-pressed={loop}
        title="Repeat this segment (L)"
        className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center border px-3 font-medium uppercase tracking-wide transition-colors ${
          loop
            ? "border-accent bg-accent text-accent-contrast"
            : "border-rule text-foreground-dim hover:border-accent hover:text-accent"
        }`}
      >
        {loop ? "◉ Loop" : "◎ Loop"}
      </button>

      <div className="inline-flex min-h-11 items-center border border-rule">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSpeedChange(s)}
            aria-pressed={speed === s}
            className={`min-h-11 cursor-pointer px-2.5 tabular-nums transition-colors ${
              speed === s ? "bg-accent text-accent-contrast" : "text-foreground-dim hover:text-accent"
            }`}
          >
            {s}×
          </button>
        ))}
      </div>

      {statusControls}

      <button
        type="button"
        onClick={expanded ? exitExpanded : enterExpanded}
        title={expanded ? "Exit fullscreen (F)" : "Fullscreen (F)"}
        className={`${iconButton} ml-auto`}
      >
        {expanded ? "⤡ Exit" : "⤢ Full"}
      </button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={
        expanded
          ? // A real full-viewport surface: dvh so iOS's collapsing toolbars
            // don't leave dead space, and `overflow-hidden` because an
            // overlay that scrolls the video off-screen is worse than no
            // overlay at all. Safe-area padding keeps the controls clear of
            // the notch and the home indicator.
            "fixed inset-0 z-50 flex h-dvh flex-col gap-2 overflow-hidden bg-background p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]"
          : "flex flex-col gap-3"
      }
    >
      <div
        className={
          expanded
            ? // Fill whatever the chrome doesn't need, and letterbox inside
              // it. The previous `max-h-[72vh]` clamp cost roughly half the
              // picture area in landscape and forced the overlay to scroll.
              "min-h-0 w-full flex-1 overflow-hidden bg-black"
            : "aspect-video w-full overflow-hidden bg-black"
        }
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

      {nowPlaying && <div className="shrink-0">{nowPlaying}</div>}

      <div className="shrink-0">{controlBar}</div>

      {expanded && (prevSegment || nextSegment) && (
        <div className="flex shrink-0 items-center justify-between gap-3 font-mono text-xs text-foreground-dim">
          {prevSegment ? (
            <Link
              href={`/songs/${songId}?segment=${prevSegment.id}`}
              className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-accent"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="tabular-nums text-foreground-dim/70">
            {index + 1} / {navSegments.length}
          </span>
          {nextSegment ? (
            <Link
              href={`/songs/${songId}?segment=${nextSegment.id}`}
              className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-accent"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
