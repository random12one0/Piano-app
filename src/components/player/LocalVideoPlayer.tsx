"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";
import type { PlayerBackendProps, PlayerHandle } from "./types";

const MAX_AUTO_RETRIES = 3;
// How long a stall may last before we assume the source went away rather than
// the network being briefly slow.
const STALL_TIMEOUT_MS = 8000;

function freshMediaUrl(sourceRef: string) {
  // Cache-busted so the browser re-requests /api/media instead of reusing a
  // resolved (and possibly now-expired) presigned R2 URL from the last load.
  return `${mediaUrl(sourceRef)}?t=${Date.now()}`;
}

const LocalVideoPlayer = forwardRef<PlayerHandle, PlayerBackendProps>(function LocalVideoPlayer(
  { sourceRef, startAt, onReady, onTick },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(startAt);
  const retriesRef = useRef(0);

  // Listeners are attached once per media source, so they must not capture
  // the callbacks from that one render — otherwise everything the parent's
  // handler closes over (the current segment, loop state, speed) is frozen
  // at attach time. Refs keep the listeners pointed at the live handlers.
  const onTickRef = useRef(onTick);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onTickRef.current = onTick;
    onReadyRef.current = onReady;
  });
  const [src, setSrc] = useState(() => mediaUrl(sourceRef));
  // A presigned R2 URL is only good for a few hours — long enough for a
  // normal session, but a phone left backgrounded overnight can outlast it.
  // "reconnecting" surfaces that instead of silently failing.
  const [reconnecting, setReconnecting] = useState(false);

  const retry = useCallback(() => {
    const el = videoRef.current;
    // Note `??`, not `||` — position 0 is a legitimate playhead, and treating
    // it as falsy would restore a stale position when reconnecting at the
    // very start of a video.
    const live = el?.currentTime;
    resumeAtRef.current = Number.isFinite(live) ? (live as number) : resumeAtRef.current;
    retriesRef.current += 1;
    setReconnecting(true);
    setSrc(freshMediaUrl(sourceRef));
  }, [sourceRef]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleLoadedMetadata = () => {
      el.currentTime = resumeAtRef.current;
      retriesRef.current = 0;
      setReconnecting(false);
      onReadyRef.current();
    };
    const emitTick = () => onTickRef.current(el.currentTime, !el.paused);
    const handleError = () => {
      if (retriesRef.current < MAX_AUTO_RETRIES) {
        setTimeout(retry, 1000 * 2 ** retriesRef.current);
      } else {
        setReconnecting(true);
      }
    };
    // An expired presigned URL usually surfaces mid-stream as a stall rather
    // than an `error`: the 403 lands on a range request, the buffer runs dry,
    // and the video just freezes with the controls still saying "playing".
    // Treat a stall that doesn't clear as a dead source and re-sign.
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const clearStall = () => {
      if (stallTimer) {
        clearTimeout(stallTimer);
        stallTimer = null;
      }
    };
    const handleStall = () => {
      if (stallTimer || el.paused || el.ended) return;
      stallTimer = setTimeout(() => {
        stallTimer = null;
        if (el.paused || el.ended) return;
        if (retriesRef.current < MAX_AUTO_RETRIES) retry();
        else setReconnecting(true);
      }, STALL_TIMEOUT_MS);
    };

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("timeupdate", emitTick);
    // `timeupdate` is not guaranteed to fire at the moment playback stops —
    // iOS Safari in particular is unreliable — so the transitions that
    // matter for saving progress get their own explicit listeners.
    el.addEventListener("play", emitTick);
    el.addEventListener("pause", emitTick);
    el.addEventListener("ended", emitTick);
    el.addEventListener("seeked", emitTick);
    el.addEventListener("error", handleError);
    el.addEventListener("stalled", handleStall);
    el.addEventListener("waiting", handleStall);
    el.addEventListener("playing", clearStall);
    el.addEventListener("canplay", clearStall);
    el.addEventListener("pause", clearStall);
    return () => {
      clearStall();
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("timeupdate", emitTick);
      el.removeEventListener("play", emitTick);
      el.removeEventListener("pause", emitTick);
      el.removeEventListener("ended", emitTick);
      el.removeEventListener("seeked", emitTick);
      el.removeEventListener("error", handleError);
      el.removeEventListener("stalled", handleStall);
      el.removeEventListener("waiting", handleStall);
      el.removeEventListener("playing", clearStall);
      el.removeEventListener("canplay", clearStall);
      el.removeEventListener("pause", clearStall);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    setPlaybackRate: (rate) => {
      if (videoRef.current) videoRef.current.playbackRate = rate;
    },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    getDuration: () => videoRef.current?.duration || 0,
  }));

  return (
    <div className="relative h-full w-full">
      <video ref={videoRef} src={src} controls playsInline className="h-full w-full bg-black" />
      {reconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim">
          <span>Reconnecting…</span>
          <button
            type="button"
            onClick={retry}
            className="cursor-pointer border border-accent px-3 py-1.5 text-accent transition-colors hover:bg-accent hover:text-accent-contrast"
          >
            Retry now
          </button>
        </div>
      )}
    </div>
  );
});

export default LocalVideoPlayer;
