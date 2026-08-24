"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { loadYouTubeIframeApi } from "@/lib/loadYouTubeIframeApi";
import type { PlayerBackendProps, PlayerHandle } from "./types";

const YouTubePlayer = forwardRef<PlayerHandle, PlayerBackendProps>(function YouTubePlayer(
  { sourceRef, startAt, onReady, onTick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elementId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;

      const player = new YT.Player(elementId.current, {
        videoId: sourceRef,
        playerVars: { start: Math.floor(startAt), rel: 0 },
        events: {
          onReady: () => {
            playerRef.current = player;
            onReady();
            intervalRef.current = setInterval(() => {
              const state = player.getPlayerState();
              onTick(player.getCurrentTime(), state === YT.PlayerState.PLAYING);
            }, 1000);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceRef]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    setPlaybackRate: (rate) => playerRef.current?.setPlaybackRate(rate),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    getDuration: () => playerRef.current?.getDuration() ?? 0,
  }));

  return <div ref={containerRef} id={elementId.current} className="h-full w-full" />;
});

export default YouTubePlayer;
