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

export interface EngineState {
  score: number;
  lives: number;
  level: number;
}

export function createStateReporter(
  onStateChange: (state: EngineState) => void,
): (state: EngineState) => void {
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  return (state: EngineState) => {
    if (
      state.score !== lastScore ||
      state.lives !== lastLives ||
      state.level !== lastLevel
    ) {
      lastScore = state.score;
      lastLives = state.lives;
      lastLevel = state.level;
      onStateChange(state);
    }
  };
}
