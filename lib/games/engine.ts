export interface GameCallbacks {
  onStateChange(state: { score: number; lives: number; level: number }): void;
  onGameOver(finalScore: number): void;
}

export interface GameHandle {
  setPaused(paused: boolean): void;
  destroy(): void;
}

export type GameFactory = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
) => GameHandle;
