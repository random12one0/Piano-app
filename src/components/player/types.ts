export type PlayerHandle = {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  setPlaybackRate: (rate: number) => void;
  getCurrentTime: () => number;
};

export type PlayerBackendProps = {
  sourceRef: string;
  startAt: number;
  onReady: () => void;
  onTick: (currentTime: number, isPlaying: boolean) => void;
};
