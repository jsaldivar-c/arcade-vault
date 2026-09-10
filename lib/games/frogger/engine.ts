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

const ROAD_SPEED_MIN = 1.5;
const ROAD_SPEED_MAX = 4;
const RIVER_SPEED_MIN = 1;
const RIVER_SPEED_MAX = 3;
const LEVEL_SPEED_SCALE = 1.15;

const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGE_MS = 1500;
const TURTLE_CYCLE_MS = TURTLE_VISIBLE_MS + TURTLE_SUBMERGE_MS;

const JUMP_DURATION_MS = 120;

const PREVENT_DEFAULT_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const DIRECTION_CODES: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// ── Paleta de colores (por defecto — skin-designer la reemplaza más tarde) ─
const COLOR_BG_ROAD = "#000000";
const COLOR_BG_RIVER = "#0a1a4a";
const COLOR_BG_SAFE = "#123a1f";
const COLOR_GOAL_BG = "#3ddc63";
const COLOR_GOAL_BORDER = "#e8c33d";
const COLOR_GOAL_FROG = "#1c7a3a";
const COLOR_CAR = "#3498db";
const COLOR_TRUCK = "#c0392b";
const COLOR_WHEEL = "#1a1a1a";
const COLOR_LOG = "#7b4a20";
const COLOR_LOG_GRAIN = "rgba(0,0,0,0.35)";
const COLOR_TURTLE = "#2e8b3d";
const COLOR_TURTLE_SHELL = "#1c5c27";
const COLOR_TURTLE_SUBMERGED = "rgba(255,255,255,0.25)";
const COLOR_FROG = "#39ff6a";
const COLOR_FROG_EYE = "#0a2e12";
const COLOR_HUD_BG = "rgba(0,0,0,0.55)";
const COLOR_HUD_TEXT = "#ffffff";
const COLOR_TIMER_TRACK = "rgba(255,255,255,0.15)";
const COLOR_TIMER_OK = "#39ff6a";
const COLOR_TIMER_WARN = "#ffd54f";
const COLOR_TIMER_DANGER = "#ff5252";

type Direction = "up" | "down" | "left" | "right";

interface Entity {
  col: number;
  width: number;
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  // Desfase de tiempo (ms) para que las tortugas de un mismo carril no
  // se sumerjan todas al mismo instante.
  phaseOffset?: number;
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

// ── Utils ────────────────────────────────────────────────────────────────
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Construcción de carriles ────────────────────────────────────────────
function generateRoadEntities(): Entity[] {
  const entities: Entity[] = [];
  let col = -randInt(0, 3);
  while (col < COLS + 3) {
    const width = randInt(1, 3);
    entities.push({ col, width, type: width === 3 ? "truck" : "car" });
    col += width + randInt(2, 5);
  }
  return entities;
}

function generateRiverEntities(type: "log" | "turtle"): Entity[] {
  const entities: Entity[] = [];
  let col = -randInt(0, 4);
  while (col < COLS + 4) {
    const width = type === "log" ? randInt(2, 4) : randInt(2, 3);
    const entity: Entity = { col, width, type };
    if (type === "turtle") {
      entity.submerged = false;
      entity.phaseOffset = Math.random() * TURTLE_CYCLE_MS;
    }
    entities.push(entity);
    col += width + randInt(1, 3);
  }
  return entities;
}

function buildLanes(level: number): Lane[] {
  const scale = Math.pow(LEVEL_SPEED_SCALE, level - 1);
  const lanes: Lane[] = [];

  for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++) {
    const i = row - ROW_ROAD_TOP;
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const speed = rand(ROAD_SPEED_MIN, ROAD_SPEED_MAX) * scale;
    lanes.push({ row, speed, dir, entities: generateRoadEntities() });
  }

  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    const i = row - ROW_RIVER_TOP;
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const speed = rand(RIVER_SPEED_MIN, RIVER_SPEED_MAX) * scale;
    const type: "log" | "turtle" = i % 2 === 0 ? "log" : "turtle";
    lanes.push({ row, speed, dir, entities: generateRiverEntities(type) });
  }

  return lanes;
}

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
): GameHandle {
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }
  const ctx = maybeCtx;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;

  // ── Estado del juego (encapsulado por instancia) ─────────────────────────
  let lanes: Lane[] = [];
  let goals: boolean[] = [];
  let frog!: Frog;
  let score = 0;
  let lives = 3;
  let level = 1;
  let bestRowThisRound = ROW_START;
  let roundTimeLeftMs = 0;
  let elapsedMs = 0;

  let state: "playing" | "gameover" = "playing";
  let gameOverFired = false;
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  let lastReportedScore = -1;
  let lastReportedLives = -1;
  let lastReportedLevel = -1;

  let pendingDirection: Direction | null = null;

  // ── Input (encapsulado por instancia) ────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    const dir = DIRECTION_CODES[e.code];
    if (!dir || state !== "playing") return;
    pendingDirection = dir;
  }

  window.addEventListener("keydown", handleKeyDown);

  // ── Helpers de ronda / rana ───────────────────────────────────────────────
  function roundTimeSec(lvl: number): number {
    return Math.max(8, 15 - (lvl - 1));
  }

  function spawnFrog(): Frog {
    return {
      col: FROG_START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: FROG_START_COL,
      targetRow: ROW_START,
    };
  }

  function resetRound() {
    frog = spawnFrog();
    bestRowThisRound = ROW_START;
    roundTimeLeftMs = roundTimeSec(level) * 1000;
    pendingDirection = null;
  }

  function respawnFrog() {
    frog = spawnFrog();
    roundTimeLeftMs = roundTimeSec(level) * 1000;
    pendingDirection = null;
  }

  function initGame() {
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    gameOverFired = false;
    elapsedMs = 0;
    lastReportedScore = -1;
    lastReportedLives = -1;
    lastReportedLevel = -1;
    lanes = buildLanes(level);
    goals = new Array(GOAL_COUNT).fill(false);
    resetRound();
  }

  function completeRound() {
    level++;
    lanes = buildLanes(level);
    goals = new Array(GOAL_COUNT).fill(false);
    resetRound();
  }

  function reportState() {
    if (
      score !== lastReportedScore ||
      lives !== lastReportedLives ||
      level !== lastReportedLevel
    ) {
      lastReportedScore = score;
      lastReportedLives = lives;
      lastReportedLevel = level;
      callbacks.onStateChange({ score, lives, level });
    }
  }

  function killFrog() {
    if (state !== "playing") return;
    lives = Math.max(0, lives - 1);
    if (lives === 0) {
      state = "gameover";
      callbacks.onStateChange({ score, lives: 0, level });
      lastReportedScore = score;
      lastReportedLives = 0;
      lastReportedLevel = level;
      if (!gameOverFired) {
        gameOverFired = true;
        callbacks.onGameOver(score);
      }
      return;
    }
    respawnFrog();
  }

  // ── Colisiones y soporte ──────────────────────────────────────────────────
  function laneAt(row: number): Lane | undefined {
    return lanes.find((l) => l.row === row);
  }

  function checkRoadCollision(f: Frog): boolean {
    const lane = laneAt(f.row);
    if (!lane) return false;
    return lane.entities.some((e) => f.col >= e.col && f.col < e.col + e.width);
  }

  function getSupport(f: Frog): Entity | null {
    const lane = laneAt(f.row);
    if (!lane) return null;
    const entity = lane.entities.find(
      (e) => f.col >= e.col && f.col < e.col + e.width,
    );
    if (!entity) return null;
    if (entity.type === "turtle" && entity.submerged) return null;
    return entity;
  }

  function goalIndexForCol(col: number): number | null {
    const idx = Math.floor((col - 2) / 4);
    if (idx < 0 || idx >= GOAL_COUNT) return null;
    const start = 2 + idx * 4;
    if (col < start || col >= start + GOAL_WIDTH) return null;
    return idx;
  }

  function checkGoal(f: Frog) {
    const idx = goalIndexForCol(f.col);
    if (idx === null || goals[idx]) {
      killFrog();
      return;
    }
    goals[idx] = true;
    const timeBonus = Math.round((roundTimeLeftMs / 1000) * 10);
    score += 50 + timeBonus;
    if (goals.every(Boolean)) {
      score += 200;
      completeRound();
    }
  }

  // ── Update ────────────────────────────────────────────────────────────────
  function startJump(dir: Direction) {
    const baseCol = Math.round(frog.col);
    let targetCol = baseCol;
    let targetRow = frog.row;
    if (dir === "up") targetRow -= 1;
    if (dir === "down") targetRow += 1;
    if (dir === "left") targetCol -= 1;
    if (dir === "right") targetCol += 1;

    targetRow = Math.max(0, Math.min(ROWS - 1, targetRow));
    if (targetCol < 0 || targetCol >= COLS) targetCol = baseCol;

    if (targetCol === baseCol && targetRow === frog.row) return;

    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = targetCol;
    frog.targetRow = targetRow;
  }

  function resolveLanding() {
    if (frog.row < bestRowThisRound) {
      score += 10;
      bestRowThisRound = frog.row;
    }
    if (frog.row === ROW_GOALS) {
      checkGoal(frog);
    }
  }

  function resolveIdleZone(dt: number) {
    if (frog.row >= ROW_ROAD_TOP && frog.row <= ROW_ROAD_BOT) {
      if (checkRoadCollision(frog)) killFrog();
      return;
    }
    if (frog.row >= ROW_RIVER_TOP && frog.row <= ROW_RIVER_BOT) {
      const support = getSupport(frog);
      if (!support) {
        killFrog();
        return;
      }
      const lane = laneAt(frog.row);
      if (lane) {
        frog.col += (lane.speed * lane.dir * dt) / 16;
        if (frog.col < 0 || frog.col > COLS - 1) killFrog();
      }
    }
  }

  function update(dt: number) {
    if (state !== "playing") return;

    elapsedMs += dt;

    for (const lane of lanes) {
      for (const entity of lane.entities) {
        entity.col += (lane.speed * lane.dir * dt) / 16;
        const trackLen = COLS + entity.width;
        if (lane.dir === 1 && entity.col > COLS) entity.col -= trackLen;
        if (lane.dir === -1 && entity.col < -entity.width)
          entity.col += trackLen;
        if (entity.type === "turtle") {
          const phase =
            (elapsedMs + (entity.phaseOffset ?? 0)) % TURTLE_CYCLE_MS;
          entity.submerged = phase >= TURTLE_VISIBLE_MS;
        }
      }
    }

    if (!frog.animating) {
      if (pendingDirection) {
        const dir = pendingDirection;
        pendingDirection = null;
        startJump(dir);
      }
    } else {
      frog.animT += dt;
      if (frog.animT >= JUMP_DURATION_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        resolveLanding();
      }
    }

    if (state === "playing" && !frog.animating) {
      resolveIdleZone(dt);
    }

    if (state === "playing") {
      roundTimeLeftMs -= dt;
      if (roundTimeLeftMs <= 0) {
        roundTimeLeftMs = 0;
        killFrog();
      }
    }

    reportState();
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function drawZones() {
    for (let r = 0; r < ROWS; r++) {
      const y = r * CELL;
      const isRiver = r >= ROW_RIVER_TOP && r <= ROW_RIVER_BOT;
      const isRoad = r >= ROW_ROAD_TOP && r <= ROW_ROAD_BOT;
      // Filas seguras: metas, zona intermedia y base de inicio.
      const isSafe = r === ROW_GOALS || r === ROW_SAFE_MID || r === ROW_START;
      let color: string = COLOR_BG_SAFE;
      if (isRiver) color = COLOR_BG_RIVER;
      else if (isRoad) color = COLOR_BG_ROAD;
      else if (isSafe) color = COLOR_BG_SAFE;
      ctx.fillStyle = color;
      ctx.fillRect(0, y, CANVAS_W, CELL);
    }
  }

  function drawGoals() {
    const y = ROW_GOALS * CELL;
    for (let i = 0; i < GOAL_COUNT; i++) {
      const startCol = 2 + i * 4;
      const x = startCol * CELL;
      const w = GOAL_WIDTH * CELL;
      ctx.fillStyle = COLOR_GOAL_BG;
      ctx.fillRect(x, y, w, CELL);
      ctx.strokeStyle = COLOR_GOAL_BORDER;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, CELL - 3);
      if (goals[i]) {
        ctx.fillStyle = COLOR_GOAL_FROG;
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2,
          y + CELL / 2,
          w * 0.28,
          CELL * 0.32,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }

  function drawVehicle(x: number, y: number, w: number, type: string) {
    const h = CELL - 10;
    const top = y + 5;
    ctx.fillStyle = type === "truck" ? COLOR_TRUCK : COLOR_CAR;
    ctx.fillRect(x + 2, top, w - 4, h);
    ctx.fillStyle = COLOR_WHEEL;
    const wheelR = 5;
    ctx.beginPath();
    ctx.arc(x + 10, top + h, wheelR, 0, Math.PI * 2);
    ctx.arc(x + w - 10, top + h, wheelR, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLog(x: number, y: number, w: number) {
    const h = CELL - 14;
    const top = y + 7;
    ctx.fillStyle = COLOR_LOG;
    ctx.fillRect(x + 1, top, w - 2, h);
    ctx.strokeStyle = COLOR_LOG_GRAIN;
    ctx.lineWidth = 1;
    for (let lx = x + 8; lx < x + w - 4; lx += 10) {
      ctx.beginPath();
      ctx.moveTo(lx, top + 2);
      ctx.lineTo(lx, top + h - 2);
      ctx.stroke();
    }
  }

  function drawTurtleGroup(
    x: number,
    y: number,
    count: number,
    submerged: boolean,
  ) {
    const r = CELL * 0.32;
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (submerged) {
        ctx.strokeStyle = COLOR_TURTLE_SUBMERGED;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLOR_TURTLE;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLOR_TURTLE_SHELL;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawLaneEntities() {
    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        const x = e.col * CELL;
        const w = e.width * CELL;
        if (x + w < 0 || x > CANVAS_W) continue;
        if (e.type === "car" || e.type === "truck") {
          drawVehicle(x, y, w, e.type);
        } else if (e.type === "log") {
          drawLog(x, y, w);
        } else {
          drawTurtleGroup(x, y, e.width, !!e.submerged);
        }
      }
    }
  }

  function drawFrog() {
    const t = frog.animating ? Math.min(1, frog.animT / JUMP_DURATION_MS) : 1;
    const col = frog.animating
      ? frog.col + (frog.targetCol - frog.col) * t
      : frog.col;
    const row = frog.animating
      ? frog.row + (frog.targetRow - frog.row) * t
      : frog.row;
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;
    const jumpLift = frog.animating ? Math.sin(t * Math.PI) * 8 : 0;

    ctx.save();
    ctx.translate(cx, cy - jumpLift);

    if (frog.animating) {
      ctx.strokeStyle = COLOR_FROG;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-CELL * 0.3, -CELL * 0.1);
      ctx.lineTo(-CELL * 0.5, -CELL * 0.32);
      ctx.moveTo(CELL * 0.3, -CELL * 0.1);
      ctx.lineTo(CELL * 0.5, -CELL * 0.32);
      ctx.stroke();
    }

    ctx.fillStyle = COLOR_FROG;
    ctx.beginPath();
    ctx.ellipse(0, 0, CELL * 0.34, CELL * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLOR_FROG_EYE;
    ctx.beginPath();
    ctx.arc(-CELL * 0.12, -CELL * 0.12, 3, 0, Math.PI * 2);
    ctx.arc(CELL * 0.12, -CELL * 0.12, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawHud() {
    ctx.save();
    ctx.fillStyle = COLOR_HUD_BG;
    ctx.fillRect(0, 0, CANVAS_W, 26);

    ctx.fillStyle = COLOR_HUD_TEXT;
    ctx.font = "bold 14px monospace";
    ctx.textBaseline = "middle";

    ctx.textAlign = "left";
    ctx.fillText(String(score), 10, 13);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${level}`, CANVAS_W / 2, 13);

    ctx.textAlign = "right";
    const iconSize = 12;
    for (let i = 0; i < lives; i++) {
      const fx = CANVAS_W - 10 - i * (iconSize + 4);
      ctx.fillStyle = COLOR_FROG;
      ctx.beginPath();
      ctx.ellipse(fx, 13, iconSize * 0.4, iconSize * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const totalMs = roundTimeSec(level) * 1000;
    const ratio = Math.max(0, Math.min(1, roundTimeLeftMs / totalMs));
    const barColor =
      ratio > 0.5
        ? COLOR_TIMER_OK
        : ratio > 0.2
          ? COLOR_TIMER_WARN
          : COLOR_TIMER_DANGER;
    ctx.fillStyle = COLOR_TIMER_TRACK;
    ctx.fillRect(0, 26, CANVAS_W, 4);
    ctx.fillStyle = barColor;
    ctx.fillRect(0, 26, CANVAS_W * ratio, 4);

    ctx.restore();
  }

  function draw() {
    drawZones();
    drawGoals();
    drawLaneEntities();
    drawFrog();
    drawHud();
  }

  // ── Loop principal ───────────────────────────────────────────────────────
  function loop(ts: number) {
    if (destroyed) return;

    if (paused) {
      lastTime = ts;
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 100);
    lastTime = ts;

    update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  initGame();
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
