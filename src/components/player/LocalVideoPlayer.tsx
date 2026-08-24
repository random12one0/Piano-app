"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { mediaUrl } from "@/lib/media";
import type { PlayerBackendProps, PlayerHandle } from "./types";

const MAX_AUTO_RETRIES = 3;

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
  const [src, setSrc] = useState(() => mediaUrl(sourceRef));
  // A presigned R2 URL is only good for a few hours — long enough for a
  // normal session, but a phone left backgrounded overnight can outlast it.
  // "reconnecting" surfaces that instead of silently failing.
  const [reconnecting, setReconnecting] = useState(false);

  const retry = useCallback(() => {
    const el = videoRef.current;
    resumeAtRef.current = el?.currentTime || resumeAtRef.current;
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
      onReady();
    };
    const handleTimeUpdate = () => onTick(el.currentTime, !el.paused);
    const handleError = () => {
      if (retriesRef.current < MAX_AUTO_RETRIES) {
        setTimeout(retry, 1000 * 2 ** retriesRef.current);
      } else {
        setReconnecting(true);
      }
    };

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("error", handleError);
    return () => {
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("error", handleError);
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
      <video ref={videoRef} src={src} controls className="h-full w-full bg-black" />
      {reconnecting && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 font-mono text-xs uppercase tracking-wider text-foreground-dim">
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
