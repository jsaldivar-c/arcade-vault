import {
  createStateReporter,
  type GameCallbacks,
  type GameHandle,
} from "@/lib/games/engine";

const W = 800;
const H = 600;
const COLS = 10;
const ROWS = 20;

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - púrpura
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul pálido
  "#ffb74d", // L - naranja
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const WALL_KICKS = [0, -1, 1, -2, 2];

const PREVENT_DEFAULT_CODES = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "Space",
]);

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx = maybeCtx;

  // ── Geometría del tablero dentro del canvas 800×600 ─────────────────────
  const BLOCK = Math.floor(H / ROWS);
  const BOARD_W = COLS * BLOCK;
  const BOARD_H = ROWS * BLOCK;
  const boardOffsetX = Math.floor((W - BOARD_W) / 2);
  const boardOffsetY = Math.floor((H - BOARD_H) / 2);

  const NEXT_BLOCK = 20;
  const NEXT_LABEL_H = 20;
  const NEXT_GRID_SIZE = NEXT_BLOCK * 4 + 16;
  const NEXT_BOX_W = NEXT_GRID_SIZE;
  const NEXT_BOX_H = NEXT_LABEL_H + NEXT_GRID_SIZE;
  const nextBoxX = W - NEXT_BOX_W - 16;
  const nextBoxY = 16;

  // ── Estado del juego (encapsulado por instancia) ─────────────────────────
  let board!: number[][];
  let current!: Piece;
  let next!: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropAccum = 0;
  let dropInterval = 1000;
  let gameOver = false;
  let gameOverFired = false;

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  const reportState = createStateReporter(callbacks.onStateChange);

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of WALL_KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }

  function endGame() {
    gameOver = true;
    if (!gameOverFired) {
      gameOverFired = true;
      callbacks.onGameOver(score);
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    originX: number,
    originY: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex]!;
    ctx.fillRect(
      originX + x * size + 1,
      originY + y * size + 1,
      size - 2,
      size - 2,
    );
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(originX + x * size + 1, originY + y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(boardOffsetX + c * BLOCK, boardOffsetY);
      ctx.lineTo(boardOffsetX + c * BLOCK, boardOffsetY + BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(boardOffsetX, boardOffsetY + r * BLOCK);
      ctx.lineTo(boardOffsetX + BOARD_W, boardOffsetY + r * BLOCK);
      ctx.stroke();
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      boardOffsetX - 1,
      boardOffsetY - 1,
      BOARD_W + 2,
      BOARD_H + 2,
    );
    ctx.restore();
  }

  function drawNext() {
    ctx.save();
    ctx.fillStyle = "rgba(0,245,255,0.06)";
    ctx.fillRect(nextBoxX, nextBoxY, NEXT_BOX_W, NEXT_BOX_H);

    ctx.shadowColor = "#00f5ff";
    ctx.shadowBlur = 6;
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(nextBoxX, nextBoxY, NEXT_BOX_W, NEXT_BOX_H);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(0,245,255,0.75)";
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("SIGUIENTE", nextBoxX + 8, nextBoxY + 6);

    ctx.strokeStyle = "rgba(0,245,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(nextBoxX, nextBoxY + NEXT_LABEL_H);
    ctx.lineTo(nextBoxX + NEXT_BOX_W, nextBoxY + NEXT_LABEL_H);
    ctx.stroke();
    ctx.restore();

    const shape = next.shape;
    const offC = Math.floor((4 - shape[0].length) / 2);
    const offR = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(
          offC + c,
          offR + r,
          shape[r][c],
          NEXT_BLOCK,
          nextBoxX + 8,
          nextBoxY + NEXT_LABEL_H + 8,
        );
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(c, r, board[r][c], BLOCK, boardOffsetX, boardOffsetY);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            current.x + c,
            gy + r,
            current.shape[r][c],
            BLOCK,
            boardOffsetX,
            boardOffsetY,
            0.2,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          current.x + c,
          current.y + r,
          current.shape[r][c],
          BLOCK,
          boardOffsetX,
          boardOffsetY,
        );

    drawNext();
  }

  // ── Input (encapsulado por instancia) ────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  window.addEventListener("keydown", handleKeyDown);

  // ── Loop principal ───────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    if (paused || gameOver) {
      lastTime = ts;
      reportState({ score, lives: 1, level });
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : ts - lastTime;
    lastTime = ts;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }

    draw();
    reportState({ score, lives: 1, level });
    rafId = requestAnimationFrame(loop);
  }

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropAccum = 0;
    dropInterval = 1000;
    gameOver = false;
    gameOverFired = false;
    next = randomPiece();
    spawn();
  }

  init();
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
