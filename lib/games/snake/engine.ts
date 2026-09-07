import type { GameCallbacks, GameHandle } from "@/lib/games/engine";

const W = 800;
const H = 600;

const COLS = 20;
const ROWS = 15;
const CELL = 40;

const INITIAL_TICK_MS = 150;
const MIN_TICK_MS = 60;
const TICK_STEP_MS = 10;
const FRUITS_PER_LEVEL = 5;
const POINTS_PER_FRUIT = 10;

const SPRITESHEET_URL = "/games/snake/fruits.png";

const SNAKE_HEAD_COLOR = "#00ff88";
const SNAKE_BODY_COLOR = "#00b368";

const PREVENT_DEFAULT_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Portado de references/started-games/05-snake/sprites.js (SPRITE_ATLAS.fruits)
const FRUIT_SPRITES: SpriteRect[] = [
  { sx: 34, sy: 136, sw: 110, sh: 160 }, // banana
  { sx: 186, sy: 136, sw: 150, sh: 160 }, // orange
  { sx: 378, sy: 136, sw: 110, sh: 160 }, // grape
  { sx: 540, sy: 136, sw: 130, sh: 160 }, // garlic
  { sx: 712, sy: 136, sw: 130, sh: 160 }, // eggplant
  { sx: 894, sy: 136, sw: 110, sh: 160 }, // strawberry
  { sx: 1066, sy: 136, sw: 110, sh: 160 }, // cherry
  { sx: 1228, sy: 136, sw: 130, sh: 160 }, // carrot
  { sx: 1400, sy: 136, sw: 130, sh: 160 }, // mushroom
  { sx: 1582, sy: 136, sw: 110, sh: 160 }, // broccoli
  { sx: 1734, sy: 136, sw: 150, sh: 160 }, // watermelon
  { sx: 1906, sy: 136, sw: 150, sh: 160 }, // pepper
  { sx: 2068, sy: 136, sw: 170, sh: 160 }, // kiwi
  { sx: 2250, sy: 136, sw: 140, sh: 160 }, // lemon
  { sx: 2432, sy: 136, sw: 130, sh: 160 }, // peach
  { sx: 2604, sy: 136, sw: 130, sh: 160 }, // peanut
  { sx: 2786, sy: 136, sw: 110, sh: 160 }, // apple
  { sx: 2948, sy: 136, sw: 130, sh: 160 }, // tomato
  { sx: 3110, sy: 136, sw: 150, sh: 160 }, // berries
  { sx: 3302, sy: 136, sw: 110, sh: 160 }, // grapes2
  { sx: 3454, sy: 136, sw: 150, sh: 160 }, // pineapple
  { sx: 3637, sy: 136, sw: 130, sh: 160 }, // melon
];

interface Vec {
  x: number;
  y: number;
}

const DIRECTIONS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

function isOpposite(a: Vec, b: Vec): boolean {
  return a.x === -b.x && a.y === -b.y;
}

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx = maybeCtx;

  // ── Sprites (encapsulado por instancia) ──────────────────────────────────
  let spritesheet: HTMLImageElement | null = null;
  const spriteImage = new Image();
  spriteImage.onload = () => {
    spritesheet = spriteImage;
  };
  spriteImage.src = SPRITESHEET_URL;

  // ── Estado del juego (encapsulado por instancia) ─────────────────────────
  let segments: Vec[] = [];
  let direction: Vec = DIRECTIONS.ArrowRight;
  let pendingDirection: Vec = DIRECTIONS.ArrowRight;
  let fruit: Vec = { x: 0, y: 0 };
  let fruitSprite: SpriteRect = FRUIT_SPRITES[0];
  let score = 0;
  let fruitsEaten = 0;
  let level = 1;
  let tickInterval = INITIAL_TICK_MS;
  let tickAccum = 0;

  let state: "playing" | "gameover" = "playing";
  let gameOverFired = false;
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  function resetSnake() {
    const startY = Math.floor(ROWS / 2);
    const startX = Math.floor(COLS / 2);
    segments = [
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ];
    direction = DIRECTIONS.ArrowRight;
    pendingDirection = DIRECTIONS.ArrowRight;
  }

  function placeFruit() {
    const free: Vec[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!segments.some((s) => s.x === x && s.y === y)) {
          free.push({ x, y });
        }
      }
    }
    fruit = free[Math.floor(Math.random() * free.length)];
    fruitSprite =
      FRUIT_SPRITES[Math.floor(Math.random() * FRUIT_SPRITES.length)];
  }

  function endGame() {
    state = "gameover";
    if (!gameOverFired) {
      gameOverFired = true;
      callbacks.onGameOver(score);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function tick() {
    direction = pendingDirection;
    const head = segments[0];
    const newHead: Vec = { x: head.x + direction.x, y: head.y + direction.y };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      endGame();
      return;
    }

    const ateFruit = newHead.x === fruit.x && newHead.y === fruit.y;
    const bodyToCheck = ateFruit ? segments : segments.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      endGame();
      return;
    }

    segments.unshift(newHead);
    if (ateFruit) {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
        level++;
        tickInterval = Math.max(
          MIN_TICK_MS,
          INITIAL_TICK_MS - (level - 1) * TICK_STEP_MS,
        );
      }
      placeFruit();
    } else {
      segments.pop();
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (spritesheet) {
      ctx.drawImage(
        spritesheet,
        fruitSprite.sx,
        fruitSprite.sy,
        fruitSprite.sw,
        fruitSprite.sh,
        fruit.x * CELL,
        fruit.y * CELL,
        CELL,
        CELL,
      );
    }

    segments.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR;
      ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  // ── Input (encapsulado por instancia) ────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    const candidate = DIRECTIONS[e.code];
    if (!candidate) return;
    if (isOpposite(candidate, direction)) return;
    pendingDirection = candidate;
  }

  window.addEventListener("keydown", handleKeyDown);

  // ── Loop principal ───────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    if (paused || state !== "playing") {
      lastTime = ts;
      callbacks.onStateChange({ score, lives: 1, level });
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 250);
    lastTime = ts;

    tickAccum += dt;
    while (tickAccum >= tickInterval && state === "playing") {
      tick();
      tickAccum -= tickInterval;
    }

    draw();
    callbacks.onStateChange({ score, lives: 1, level });
    rafId = requestAnimationFrame(loop);
  }

  resetSnake();
  placeFruit();
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(p: boolean) {
      paused = p;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
    },
  };
}
