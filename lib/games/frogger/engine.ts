import type { GameCallbacks, GameHandle } from "@/lib/games/engine";

const COLS = 20;
const ROWS = 15;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 800
const CANVAS_H = ROWS * CELL; // 600

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 13;
const ROW_START = 14;

const FROG_START_COL = 9;
const GOAL_WIDTH = 2;
const GOAL_COUNT = 5;

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
}

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}
