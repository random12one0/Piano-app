"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { PlayerBackendProps, PlayerHandle } from "./types";

const LocalVideoPlayer = forwardRef<PlayerHandle, PlayerBackendProps>(function LocalVideoPlayer(
  { sourceRef, startAt, onReady, onTick },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleLoadedMetadata = () => {
      el.currentTime = startAt;
      onReady();
    };
    const handleTimeUpdate = () => onTick(el.currentTime, !el.paused);

    el.addEventListener("loadedmetadata", handleLoadedMetadata);
    el.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      el.removeEventListener("loadedmetadata", handleLoadedMetadata);
      el.removeEventListener("timeupdate", handleTimeUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRef]);

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
  }));

  return (
    <video ref={videoRef} src={sourceRef} controls className="h-full w-full bg-black" />
  );
});

export default LocalVideoPlayer;
