import type { GameCallbacks, GameHandle } from "@/lib/games/engine";
import { getSkin } from "@/lib/games/skins";
import { ARKANOID_PALETTES } from "@/lib/games/arkanoid/skins";

const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150;
const POINTS_PER_BLOCK = 10;
const TOTAL_LEVELS = 5;

const SPRITESHEET_URL = "/games/arkanoid/spritesheet-breakout.png";
const BOUNCE_SOUND_URL = "/games/arkanoid/sounds/ball-bounce.mp3";
const BREAK_SOUND_URL = "/games/arkanoid/sounds/break-sound.mp3";

const PREVENT_DEFAULT_CODES = new Set(["ArrowLeft", "ArrowRight"]);

type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

interface SpriteRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const SPRITES: {
  paddle: SpriteRect;
  ball: SpriteRect;
  blocks: Record<BlockColor, SpriteRect>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

const EXPLOSION_FRAMES: Record<BlockColor, SpriteRect[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

interface LevelBlockDef {
  col: number;
  row: number;
  color: BlockColor;
}

interface Level {
  speed: number;
  blocks: LevelBlockDef[];
}

const LEVELS: Level[] = (() => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: LevelBlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlockDef[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlockDef[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++)
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number;
}

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx = maybeCtx;

  // Paleta de colores de la skin activa, resuelta una sola vez al crear esta
  // instancia del motor (el canvas fuerza un remount completo al cambiar de
  // skin, ver components/games/arkanoid-canvas.tsx).
  const palette = ARKANOID_PALETTES[getSkin("arkanoid")];

  // ── Sprites y sonido (encapsulado por instancia) ─────────────────────────
  let spritesheet: HTMLImageElement | null = null;
  const spriteImage = new Image();
  spriteImage.onload = () => {
    spritesheet = spriteImage;
  };
  spriteImage.src = SPRITESHEET_URL;

  const bounceSound = new Audio(BOUNCE_SOUND_URL);
  const breakSound = new Audio(BREAK_SOUND_URL);

  function playSound(sound: HTMLAudioElement) {
    const clone = sound.cloneNode(true) as HTMLAudioElement;
    clone.play().catch(() => {});
  }

  // ── Estado del juego (encapsulado por instancia) ─────────────────────────
  const paddle: Paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = {
    x: 0,
    y: 0,
    w: 16,
    h: 16,
    vx: BASE_BALL_VX,
    vy: BASE_BALL_VY,
  };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let state: "playing" | "gameover" = "playing";
  let gameOverFired = false;

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function resetBallOnPaddle() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function endGame() {
    state = "gameover";
    if (!gameOverFired) {
      gameOverFired = true;
      callbacks.onGameOver(score);
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state !== "playing") return;

    if (keys.ArrowLeft) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += POINTS_PER_BLOCK;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < TOTAL_LEVELS) loadLevel(currentLevel + 1);
          else endGame();
        }
        break; // un bloque por frame
      }
    }

    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        endGame();
      } else {
        resetBallOnPaddle();
      }
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function draw() {
    if (!spritesheet) return;
    const sheet = spritesheet;

    // Fondo fijo en las 3 skins: no forma parte de la paleta de gameplay,
    // es el mismo negro casi puro que usa el marco CRT en toda la app. Se
    // limpia con el filtro apagado para que nunca herede el de la skin.
    ctx.filter = "none";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Reinterpreta el bitmap del spritesheet para bloques/explosiones/pala/
    // bola sin tocar el archivo — "none" en clasico deja el render idéntico
    // al de hoy.
    ctx.filter = palette.spriteFilter;

    for (const block of blocks) {
      if (!block.alive) continue;
      const sprite = SPRITES.blocks[block.color];
      ctx.drawImage(
        sheet,
        sprite.sx,
        sprite.sy,
        sprite.sw,
        sprite.sh,
        block.x,
        block.y,
        block.w,
        block.h,
      );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      const frame = EXPLOSION_FRAMES[exp.color][frameIndex];
      ctx.drawImage(
        sheet,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    if (palette.paddleGlow) {
      ctx.shadowColor = palette.paddleGlow;
      ctx.shadowBlur = palette.glowBlur;
    }
    ctx.drawImage(
      sheet,
      SPRITES.paddle.sx,
      SPRITES.paddle.sy,
      SPRITES.paddle.sw,
      SPRITES.paddle.sh,
      paddle.x,
      paddle.y,
      paddle.w,
      paddle.h,
    );
    ctx.shadowBlur = 0;

    if (palette.ballGlow) {
      ctx.shadowColor = palette.ballGlow;
      ctx.shadowBlur = palette.glowBlur;
    }
    ctx.drawImage(
      sheet,
      SPRITES.ball.sx,
      SPRITES.ball.sy,
      SPRITES.ball.sw,
      SPRITES.ball.sh,
      ball.x,
      ball.y,
      ball.w,
      ball.h,
    );
    ctx.shadowBlur = 0;
    ctx.filter = "none";
  }

  // ── Input (encapsulado por instancia) ────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    if (e.code in keys) keys[e.code] = true;
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code in keys) keys[e.code] = false;
  }

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // ── Loop principal ───────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    if (!spritesheet) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    if (paused || state !== "playing") {
      lastTime = ts;
      callbacks.onStateChange({ score, lives, level: currentLevel });
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    update(dt);
    draw();
    callbacks.onStateChange({ score, lives, level: currentLevel });
    rafId = requestAnimationFrame(loop);
  }

  initPaddle();
  loadLevel(1);
  rafId = requestAnimationFrame(loop);

  return {
    setPaused(p: boolean) {
      paused = p;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    },
  };
}
