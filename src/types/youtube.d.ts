// Minimal ambient types for the YouTube IFrame Player API — just the
// surface this app actually uses.
declare namespace YT {
  interface PlayerEvent {
    target: Player;
  }
  interface OnStateChangeEvent extends PlayerEvent {
    data: number;
  }
  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    playVideo(): void;
    pauseVideo(): void;
    setPlaybackRate(rate: number): void;
    getCurrentTime(): number;
    getPlayerState(): number;
    destroy(): void;
  }
  interface PlayerOptions {
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
    };
  }
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

interface Window {
  YT?: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
