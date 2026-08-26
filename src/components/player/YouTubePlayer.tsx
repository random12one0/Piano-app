"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadYouTubeIframeApi } from "@/lib/loadYouTubeIframeApi";
import type { PlayerBackendProps, PlayerHandle } from "./types";

const YouTubePlayer = forwardRef<PlayerHandle, PlayerBackendProps>(function YouTubePlayer(
  { sourceRef, startAt, onReady, onTick },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // A video that's been taken down, made private, or blocked from embedding
  // renders YouTube's own black panel and never ticks — the app would sit
  // there looking merely slow. Say what happened instead.
  const [failed, setFailed] = useState(false);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elementId = useRef(`yt-player-${Math.random().toString(36).slice(2)}`);

  // The player is created once per video and its polling interval lives for
  // that whole lifetime — so it must not capture the callbacks from the
  // render that happened to create it. Reading them through refs keeps the
  // interval on the *current* handlers without tearing the player down and
  // rebuilding the iframe on every render.
  const onTickRef = useRef(onTick);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onTickRef.current = onTick;
    onReadyRef.current = onReady;
  });

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !containerRef.current) return;

      const player = new YT.Player(elementId.current, {
        videoId: sourceRef,
        playerVars: { start: Math.floor(startAt), rel: 0 },
        events: {
          onReady: () => {
            playerRef.current = player;
            onReadyRef.current();
            intervalRef.current = setInterval(() => {
              const state = player.getPlayerState();
              onTickRef.current(player.getCurrentTime(), state === YT.PlayerState.PLAYING);
            }, 1000);
          },
          onError: () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setFailed(true);
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} id={elementId.current} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 px-6 text-center font-mono text-xs text-foreground-dim">
          <span className="uppercase tracking-wider text-flag">Video unavailable</span>
          <span>
            YouTube won&rsquo;t play {sourceRef} here — it may have been removed, made private, or
            blocked from embedding.
          </span>
        </div>
      )}
    </div>
  );
});

export default YouTubePlayer;
