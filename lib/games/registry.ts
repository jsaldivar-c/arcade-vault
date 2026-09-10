import { AsteroidsCanvas } from "@/components/games/asteroids-canvas";
import { TetrisCanvas } from "@/components/games/tetris-canvas";
import { ArkanoidCanvas } from "@/components/games/arkanoid-canvas";
import { SnakeCanvas } from "@/components/games/snake-canvas";
import { FroggerCanvas } from "@/components/games/frogger-canvas";

export interface GameCanvasProps {
  paused: boolean;
  restartKey: number;
  onStateChange: (state: {
    score: number;
    lives: number;
    level: number;
  }) => void;
  onGameOver: (finalScore: number) => void;
}

export type GameCanvasComponent = (
  props: GameCanvasProps,
) => React.ReactElement;

export const GAME_CANVAS_REGISTRY: Record<string, GameCanvasComponent> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas,
  frogger: FroggerCanvas,
};
