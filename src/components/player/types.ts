export type PlayerHandle = {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
  /** Live duration reported by the backend, once known (0 before ready). */
  getDuration: () => number;
};

export type PlayerBackendProps = {
  sourceRef: string;
  startAt: number;
  onReady: () => void;
  onTick: (currentTime: number, isPlaying: boolean) => void;
};
