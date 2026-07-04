import { createEmptyBoard, cloneBoard, hasCollision } from "./board.js";
import { mergeIntoCell, resolveBoardState } from "./rules.js";
import { MAX_LEVEL } from "./scoring.js";

const DEFAULT_ROWS = 11;
const DEFAULT_COLS = 4;
const BASE_DROP_INTERVAL = 520;
const SOFT_DROP_INTERVAL = 80;

function randomLevel(rng) {
  return Math.floor(rng() * 2);
}

function createPiece(level, x) {
  return { x, y: 0, level };
}

function normalizeOptions(options = {}) {
  return {
    rows: options.rows || DEFAULT_ROWS,
    cols: options.cols || DEFAULT_COLS,
    mode: options.mode || "endless",
    speedMultiplier: options.speedMultiplier || 1,
    quickTargetScore: options.quickTargetScore || 25,
  };
}

export function createGame(options = {}) {
  let config = normalizeOptions(options);
  const rng = options.rng || Math.random;
  let board = createEmptyBoard(config.rows, config.cols);
  let currentPiece = null;
  let nextPieceLevel = null;
  let status = "idle";
  let pauseReason = null;
  let score = 0;
  let elapsedMs = 0;
  let lastTickTime = 0;
  let lastDropTime = 0;
  let fallProgress = 0;
  let isSoftDropping = false;
  let events = [];

  function emit(event) {
    events.push({ ...event, at: Date.now() });
  }

  function isTerminal() {
    return status === "gameOver" || status === "won";
  }

  function shouldWin() {
    return config.mode === "quick" && score >= config.quickTargetScore;
  }

  function spawnNewPiece() {
    if (nextPieceLevel === null) {
      nextPieceLevel = randomLevel(rng);
    }

    const level = nextPieceLevel;
    const x = Math.floor(rng() * config.cols);
    currentPiece = createPiece(level, x);
    nextPieceLevel = randomLevel(rng);
    fallProgress = 0;
    emit({ type: "spawn", piece: { ...currentPiece }, nextLevel: nextPieceLevel });

    if (board[0][x]) {
      status = shouldWin() ? "won" : "gameOver";
      currentPiece = null;
      emit({ type: status });
    }
  }

  function start(nextOptions = {}) {
    config = normalizeOptions({ ...config, ...nextOptions });
    board = createEmptyBoard(config.rows, config.cols);
    currentPiece = null;
    nextPieceLevel = randomLevel(rng);
    status = "running";
    pauseReason = null;
    score = 0;
    elapsedMs = 0;
    lastTickTime = 0;
    lastDropTime = 0;
    fallProgress = 0;
    isSoftDropping = false;
    events = [];
    spawnNewPiece();
  }

  function pause(reason = "manual") {
    if (status !== "running") {
      return;
    }
    status = "paused";
    pauseReason = reason;
    isSoftDropping = false;
    emit({ type: "pause", reason });
  }

  function resume(reason = "manual") {
    if (status !== "paused") {
      return;
    }
    if (pauseReason === "manual" && reason !== "manual") {
      return;
    }
    status = "running";
    pauseReason = null;
    lastTickTime = 0;
    lastDropTime = 0;
    emit({ type: "resume", reason });
  }

  function exit() {
    status = "idle";
    pauseReason = null;
    currentPiece = null;
    isSoftDropping = false;
    fallProgress = 0;
    emit({ type: "exit" });
  }

  function move(dx) {
    if (status !== "running" || !currentPiece) {
      return false;
    }
    if (!hasCollision(board, currentPiece, dx, 0)) {
      currentPiece.x += dx;
      emit({ type: "move", dx, piece: { ...currentPiece } });
      return true;
    }
    return false;
  }

  function settleCurrentPiece() {
    if (!currentPiece || isTerminal()) {
      return;
    }

    const nextY = currentPiece.y + 1;
    const belowCell = nextY >= 0 && nextY < config.rows ? board[nextY][currentPiece.x] : null;
    let localScore = 0;
    let localEvents = [];

    if (belowCell && belowCell.level === currentPiece.level) {
      const result = mergeIntoCell(board, currentPiece.x, currentPiece.y, nextY, currentPiece.level);
      localScore += result.score;
      localEvents.push(...result.events);
    } else if (currentPiece.y < 0) {
      status = shouldWin() ? "won" : "gameOver";
      emit({ type: status });
      return;
    } else {
      board[currentPiece.y][currentPiece.x] = {
        level: Math.min(MAX_LEVEL, currentPiece.level),
      };
      localEvents.push({ type: "lock", piece: { ...currentPiece } });
    }

    const resolveResult = resolveBoardState(board, currentPiece.x);
    localScore += resolveResult.score;
    localEvents.push(...resolveResult.events);
    score += localScore;
    localEvents.forEach(emit);

    if (shouldWin()) {
      status = "won";
      currentPiece = null;
      isSoftDropping = false;
      emit({ type: "won" });
      return;
    }

    isSoftDropping = false;
    spawnNewPiece();
    lastDropTime = 0;
    fallProgress = 0;
  }

  function moveDown() {
    if (status !== "running" || !currentPiece) {
      return;
    }

    const nextY = currentPiece.y + 1;
    const blockedByFloor = nextY >= config.rows;
    const belowCell = nextY >= 0 && nextY < config.rows ? board[nextY][currentPiece.x] : null;

    if (!blockedByFloor && !belowCell) {
      currentPiece.y += 1;
      if (hasCollision(board, currentPiece, 0, 1)) {
        settleCurrentPiece();
      }
      return;
    }

    settleCurrentPiece();
  }

  function tick(timestamp) {
    if (status !== "running") {
      return;
    }

    if (!lastTickTime) {
      lastTickTime = timestamp;
    }
    if (!lastDropTime) {
      lastDropTime = timestamp;
    }

    const frameDelta = Math.max(0, timestamp - lastTickTime);
    elapsedMs += frameDelta;
    lastTickTime = timestamp;

    const interval = isSoftDropping ? SOFT_DROP_INTERVAL : BASE_DROP_INTERVAL / config.speedMultiplier;
    const dropDelta = timestamp - lastDropTime;
    fallProgress = Math.max(0, Math.min(1, dropDelta / interval));

    if (dropDelta >= interval) {
      moveDown();
      lastDropTime = timestamp;
      fallProgress = 0;
    }

    if (shouldWin() && status === "running") {
      status = "won";
      currentPiece = null;
      emit({ type: "won" });
    }
  }

  function softDropStart() {
    if (status !== "running") {
      return;
    }
    isSoftDropping = true;
  }

  function softDropStop() {
    if (status !== "running") {
      return;
    }
    isSoftDropping = false;
    lastDropTime = 0;
  }

  function getSnapshot() {
    const snapshotEvents = events.slice(-12);
    return {
      config: { ...config },
      board: cloneBoard(board),
      currentPiece: currentPiece ? { ...currentPiece, fallProgress } : null,
      nextPiece: nextPieceLevel === null ? null : { level: nextPieceLevel, visible: true },
      status,
      pauseReason,
      score,
      elapsedMs,
      isSoftDropping,
      events: snapshotEvents,
    };
  }

  return {
    start,
    pause,
    resume,
    exit,
    moveLeft: () => move(-1),
    moveRight: () => move(1),
    softDropStart,
    softDropStop,
    tick,
    getSnapshot,
  };
}
