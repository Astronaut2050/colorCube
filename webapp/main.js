let COLS = 4;
const ROWS = 11;
const BLOCK_SIZE = 52;
const BASE_DROP_INTERVAL = 520;
const MERGE_ANIMATION_MS = 140;
const NEXT_PREVIEW_INSET = 4;
const NEXT_PREVIEW_HEIGHT = 10;
const NEXT_PREVIEW_MORPH_MS = 260;
const NEXT_PREVIEW_REVEAL_MS = 180;
const LINE_CLEAR_ANIMATION_MS = 220;
const SOFT_DROP_INTERVAL = 80;

const PALETTES = {
  green: [
    "#f2f7e8",
    "#c8daa0",
    "#8db84e",
    "#4d7c1a",
    "#2a4a0e",
  ],
  blue: [
    "#eef4fb",
    "#b8d4f0",
    "#5b9ed4",
    "#1e6db5",
    "#0d3b6e",
  ],
  purple: [
    "#f3eefa",
    "#d0bef0",
    "#8e5fd4",
    "#5a2da8",
    "#2e1460",
  ],
};

let CURRENT_THEME = PALETTES.green;

const LEVEL_SCORES = [1, 2, 3, 4, 5];

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const canvasWrapper = document.getElementById("canvas-wrapper");
const boardBackground = document.createElement("canvas");
const boardBackgroundCtx = boardBackground.getContext("2d");
const scoreEl = document.getElementById("score");
const startPage = document.getElementById("start-page");
const startBtn = document.getElementById("start-btn");
const startSettingsBtn = document.getElementById("start-settings-btn");
const modeSelect = document.getElementById("mode-select");
const modeEndless = document.getElementById("mode-endless");
const modeQuick = document.getElementById("mode-quick");
const quickScoreSelect = document.getElementById("quick-score-select");
const quickCustomInput = document.getElementById("quick-custom-input");
const quickCustomStart = document.getElementById("quick-custom-start");
const setupStartBtn = document.getElementById("setup-start-btn");
const areaSizeOptions = document.getElementById("area-size-options");
const speedOptions = document.getElementById("speed-options");
const timerDisplay = document.getElementById("timer-display");
const timerText = document.getElementById("timer-text");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const restartBtn = document.getElementById("restart-btn");
const continueBtn = document.getElementById("continue-btn") || {
  classList: { add() {}, remove() {} },
  addEventListener() {},
};
const exitBtn = document.getElementById("exit-btn") || {
  classList: { add() {}, remove() {} },
  addEventListener() {},
};
const statusText = document.getElementById("status-text");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const settingsBackdrop = document.getElementById("settings-backdrop");
const tabRules = document.getElementById("tab-rules");
const tabControls = document.getElementById("tab-controls");
const rulesContent = document.getElementById("rules-content");
const controlsContent = document.getElementById("controls-content");

let board = createEmptyBoard();
let currentPiece = null;
let score = 0;
let dropInterval = BASE_DROP_INTERVAL;
let lastDropTime = 0;
let isSoftDropping = false;
let isPaused = false;
let isGameOver = false;
let gameStarted = false;
let gameMode = "endless";
let selectedGameMode = "endless";
let selectedCols = 4;
let selectedSpeedMultiplier = 1;
let quickTargetScore = 25;
let timerStart = 0;
let elapsedSeconds = 0;
let currentFallProgress = 0;
let nextPieceLevel = null;
let nextPreviewMorph = null;
let nextPreviewVisible = false;
let nextPreviewRevealStart = 0;

const mergeAnimations = [];
const lineClearAnimations = [];

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomLevel() {
  return Math.floor(Math.random() * 2);
}

function setSelectedButton(container, selector, selectedButton) {
  container.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle("selected", button === selectedButton);
  });
}

function configureBoardSize(cols) {
  COLS = cols;
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
  canvasWrapper.style.width = canvas.width + "px";
  canvasWrapper.style.aspectRatio = canvas.width + " / " + canvas.height;
  buildBoardBackground();
}

function createPiece(level = randomLevel(), x = Math.floor(COLS / 2)) {
  return {
    x,
    y: 0,
    level,
  };
}

function insideBoard(x, y) {
  return x >= 0 && x < COLS && y < ROWS;
}

function collision(piece, dx, dy) {
  const newX = piece.x + dx;
  const newY = piece.y + dy;

  if (newX < 0 || newX >= COLS || newY >= ROWS) {
    return true;
  }

  if (newY < 0) {
    return false;
  }

  return Boolean(board[newY][newX]);
}

function spawnNewPiece() {
  if (nextPieceLevel === null) {
    nextPieceLevel = randomLevel();
  }

  const spawnedLevel = nextPieceLevel;
  const targetColumn = Math.floor(Math.random() * COLS);
  currentPiece = createPiece(spawnedLevel, targetColumn);
  nextPieceLevel = randomLevel();
  if (gameStarted && nextPreviewVisible) {
    nextPreviewMorph = {
      level: spawnedLevel,
      targetColumn,
      startTime: performance.now(),
      duration: NEXT_PREVIEW_MORPH_MS,
    };
  }
  nextPreviewVisible = false;
  nextPreviewRevealStart = 0;
  currentFallProgress = 0;

  if (board[0][currentPiece.x]) {
    triggerGameOver();
  }
}

function tryMoveDownWithMerge() {
  if (isPaused || isGameOver || !currentPiece) {
    return;
  }

  const nextY = currentPiece.y + 1;
  const blockedByFloor = nextY >= ROWS;
  const belowCell = nextY >= 0 && nextY < ROWS ? board[nextY][currentPiece.x] : null;

  if (!blockedByFloor && !belowCell) {
    currentPiece.y += 1;
    if (collision(currentPiece, 0, 1)) {
      settleCurrentPiece();
    }
    return;
  }

  settleCurrentPiece();
}

function settleCurrentPiece() {
  if (!currentPiece) {
    return;
  }

  const nextY = currentPiece.y + 1;
  const belowCell = nextY >= 0 && nextY < ROWS ? board[nextY][currentPiece.x] : null;

  if (belowCell && belowCell.level === currentPiece.level) {
    mergeIntoCell(currentPiece.x, currentPiece.y, nextY, currentPiece.level);
  } else {
    lockPieceToBoard();
  }

  resolveBoardState(currentPiece.x);
  spawnNewPiece();
  updateScore();
  lastDropTime = 0;
  currentFallProgress = 0;
}

function mergeIntoCell(x, fromY, toY, level) {
  if (fromY >= 0) {
    mergeAnimations.push({
      from: { x, y: fromY },
      to: { x, y: toY },
      level,
      startTime: performance.now(),
      duration: MERGE_ANIMATION_MS,
    });
  }

  score += LEVEL_SCORES[level];
  board[toY][x].level = Math.min(board[toY][x].level + 1, CURRENT_THEME.length - 1);
}

function lockPieceToBoard() {
  if (currentPiece.y < 0) {
    triggerGameOver();
    return;
  }

  board[currentPiece.y][currentPiece.x] = { level: currentPiece.level };
}

function applyBoardStep() {
  let changed = false;

  for (let x = 0; x < COLS; x++) {
    if (applyColumnStep(x)) {
      changed = true;
    }
  }

  return changed;
}

function applyColumnStep(x) {
  let changed = false;

  for (let y = ROWS - 2; y >= 0; y--) {
    const cell = board[y][x];
    if (!cell) {
      continue;
    }

    let targetY = y;
    while (targetY + 1 < ROWS && !board[targetY + 1][x]) {
      targetY += 1;
    }

    const below = targetY + 1 < ROWS ? board[targetY + 1][x] : null;
    if (below && below.level === cell.level) {
      board[y][x] = null;
      mergeIntoCell(x, targetY, targetY + 1, cell.level);
      changed = true;
      continue;
    }

    if (targetY !== y) {
      board[targetY][x] = cell;
      board[y][x] = null;
      changed = true;
    }
  }

  return changed;
}

function clearLines() {
  let cleared = false;

  for (let y = ROWS - 1; y >= 0; y--) {
    const firstLevel = board[y][0]?.level;
    if (firstLevel === undefined) {
      continue;
    }

    let full = true;
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (!cell || cell.level !== firstLevel) {
        full = false;
        break;
      }
    }

    if (!full) {
      continue;
    }

    score += COLS * LEVEL_SCORES[firstLevel];
    lineClearAnimations.push({
      y,
      levels: board[y].map((cell) => cell.level),
      startTime: performance.now(),
      duration: LINE_CLEAR_ANIMATION_MS,
    });

    for (let yy = y; yy > 0; yy--) {
      board[yy] = [...board[yy - 1]];
    }
    board[0] = Array(COLS).fill(null);
    cleared = true;
    y += 1;
  }

  return cleared;
}

function resolveBoardState(startColumn = null) {
  let changed = false;
  let guard = 0;
  let activeColumns = startColumn === null
    ? Array.from({ length: COLS }, (_, x) => x)
    : [startColumn];

  do {
    let movedOrMerged = false;
    for (const x of activeColumns) {
      if (applyColumnStep(x)) {
        movedOrMerged = true;
      }
    }

    const lineCleared = clearLines();
    changed = movedOrMerged || lineCleared;
    if (lineCleared) {
      activeColumns = Array.from({ length: COLS }, (_, x) => x);
    }
    guard += 1;
  } while (changed && guard < ROWS * 4);
}

function triggerGameOver(quickWin = false) {
  isGameOver = true;
  isPaused = true;
  isSoftDropping = false;
  currentFallProgress = 0;
  statusText.textContent = "已结束";
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "游戏结束";

  if (quickWin) {
    const totalSec = elapsedSeconds;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const timeStr = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    overlaySubtitle.textContent = "用时 " + timeStr;
  } else {
    overlaySubtitle.textContent = "方块已经堆到顶部";
  }

  restartBtn.classList.remove("hidden");
  continueBtn.classList.add("hidden");
  exitBtn.classList.add("hidden");
}

function restartGame() {
  board = createEmptyBoard();
  score = 0;
  isGameOver = false;
  isPaused = false;
  isSoftDropping = false;
  gameStarted = false;
  gameMode = "endless";
  quickTargetScore = 25;
  elapsedSeconds = 0;
  timerStart = 0;
  nextPieceLevel = null;
  nextPreviewMorph = null;
  nextPreviewVisible = false;
  nextPreviewRevealStart = 0;
  currentFallProgress = 0;
  lastDropTime = 0;
  mergeAnimations.length = 0;
  lineClearAnimations.length = 0;
  timerDisplay.classList.add("hidden");
  statusText.textContent = "就绪";
  overlay.classList.add("hidden");
  restartBtn.classList.add("hidden");
  continueBtn.classList.add("hidden");
  exitBtn.classList.add("hidden");
  startPage.classList.remove("hidden");
  updateScore();
  render();
}

function exitGame() {
  board = createEmptyBoard();
  currentPiece = null;
  score = 0;
  isGameOver = false;
  isPaused = false;
  isSoftDropping = false;
  gameStarted = false;
  gameMode = "endless";
  quickTargetScore = 25;
  elapsedSeconds = 0;
  timerStart = 0;
  nextPieceLevel = null;
  nextPreviewMorph = null;
  nextPreviewVisible = false;
  nextPreviewRevealStart = 0;
  currentFallProgress = 0;
  lastDropTime = 0;
  mergeAnimations.length = 0;
  lineClearAnimations.length = 0;
  timerDisplay.classList.add("hidden");
  statusText.textContent = "就绪";
  overlay.classList.add("hidden");
  restartBtn.classList.add("hidden");
  continueBtn.classList.add("hidden");
  exitBtn.classList.add("hidden");
  startPage.classList.remove("hidden");
  updateScore();
  render();
}

function updateScore() {
  scoreEl.textContent = String(score);
}

function buildBoardBackground() {
  boardBackground.width = canvas.width;
  boardBackground.height = canvas.height;

  const gradient = boardBackgroundCtx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#42545f");
  gradient.addColorStop(1, "#29343d");

  boardBackgroundCtx.fillStyle = gradient;
  boardBackgroundCtx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawCell(x, y, level, offsetY = 0) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE + offsetY;

  ctx.fillStyle = CURRENT_THEME[level];
  ctx.fillRect(px + 3, py + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(px + 5, py + 5, BLOCK_SIZE - 18, 8);
}

function drawGridBackground() {
  ctx.drawImage(boardBackground, 0, 0);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function drawRoundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.fill();
}

function currentPieceVisualTop() {
  if (!currentPiece) {
    return Infinity;
  }

  const offsetY = collision(currentPiece, 0, 1) ? 0 : currentFallProgress * BLOCK_SIZE;
  return currentPiece.y * BLOCK_SIZE + offsetY;
}

function updateNextPreviewVisibility(time) {
  if (!gameStarted || nextPieceLevel === null || nextPreviewVisible || !currentPiece) {
    return;
  }

  const previewBottom = NEXT_PREVIEW_INSET + NEXT_PREVIEW_HEIGHT;
  if (currentPieceVisualTop() > previewBottom) {
    nextPreviewVisible = true;
    nextPreviewRevealStart = time;
  }
}

function isCurrentPieceMorphing(time) {
  if (!nextPreviewMorph || !currentPiece) {
    return false;
  }

  const isSamePiece = currentPiece.x === nextPreviewMorph.targetColumn
    && currentPiece.level === nextPreviewMorph.level;

  if (!isSamePiece) {
    return false;
  }

  if (time - nextPreviewMorph.startTime >= nextPreviewMorph.duration) {
    nextPreviewMorph = null;
    currentFallProgress = 0;
    lastDropTime = time;
    return false;
  }

  return true;
}

function drawNextPiecePreview() {
  if (!gameStarted || nextPieceLevel === null) {
    return;
  }

  const now = performance.now();
  const barX = NEXT_PREVIEW_INSET;
  const barY = NEXT_PREVIEW_INSET;
  const barWidth = canvas.width - NEXT_PREVIEW_INSET * 2;
  let morphT = 1;

  if (nextPreviewMorph) {
    morphT = Math.max(0, Math.min(1, (now - nextPreviewMorph.startTime) / nextPreviewMorph.duration));
    if (morphT >= 1) {
      nextPreviewMorph = null;
    }
  }

  ctx.save();

  if (nextPreviewVisible) {
    const revealT = nextPreviewRevealStart
      ? Math.max(0, Math.min(1, (now - nextPreviewRevealStart) / NEXT_PREVIEW_REVEAL_MS))
      : 1;
    const revealEase = easeOutCubic(revealT);
    const revealY = lerp(0, barY, revealEase);

    ctx.globalAlpha = revealEase;
    ctx.fillStyle = CURRENT_THEME[nextPieceLevel];
    drawRoundedRect(barX, revealY, barWidth, NEXT_PREVIEW_HEIGHT, NEXT_PREVIEW_HEIGHT / 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(barX + 2, revealY + 2, barWidth - 4, 2);
  }

  if (nextPreviewMorph) {
    const eased = easeOutCubic(morphT);
    const targetSize = BLOCK_SIZE - 6;
    const width = lerp(barWidth, targetSize, eased);
    const height = lerp(NEXT_PREVIEW_HEIGHT, targetSize, eased);
    const x = lerp(barX, nextPreviewMorph.targetColumn * BLOCK_SIZE + 3, eased);
    const y = lerp(barY, 3, eased);
    const radius = lerp(NEXT_PREVIEW_HEIGHT / 2, 2, eased);

    ctx.globalAlpha = 1 - 0.15 * eased;
    ctx.fillStyle = CURRENT_THEME[nextPreviewMorph.level];
    drawRoundedRect(x, y, width, height, radius);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x + 2, y + 2, Math.max(0, width - 14), Math.min(8, height / 4));
  }

  ctx.restore();
}

function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) {
        drawCell(x, y, cell.level);
      }
    }
  }
}

function drawLineClearAnimations() {
  const now = performance.now();

  for (let i = lineClearAnimations.length - 1; i >= 0; i--) {
    const anim = lineClearAnimations[i];
    const rawT = (now - anim.startTime) / anim.duration;

    if (rawT >= 1) {
      lineClearAnimations.splice(i, 1);
      continue;
    }

    const t = easeOutCubic(rawT);
    const blockInset = 3;
    const fullSize = BLOCK_SIZE - blockInset * 2;
    const height = lerp(fullSize, 4, t);
    const alpha = rawT < 0.72 ? 1 : 1 - (rawT - 0.72) / 0.28;
    const y = anim.y * BLOCK_SIZE + blockInset + fullSize - height;

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);

    for (let x = 0; x < COLS; x++) {
      const px = x * BLOCK_SIZE + blockInset;
      ctx.fillStyle = CURRENT_THEME[anim.levels[x]];
      ctx.fillRect(px, y, fullSize, height);

      if (height > 8) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.fillRect(px + 2, y + 2, fullSize - 14, Math.min(8, height / 4));
      }
    }

    ctx.restore();
  }
}

function drawCurrentPiece() {
  if (!currentPiece || currentPiece.y < 0) {
    return;
  }

  if (
    nextPreviewMorph &&
    currentPiece.x === nextPreviewMorph.targetColumn &&
    currentPiece.level === nextPreviewMorph.level
  ) {
    return;
  }

  const offsetY = collision(currentPiece, 0, 1) ? 0 : currentFallProgress * BLOCK_SIZE;
  drawCell(currentPiece.x, currentPiece.y, currentPiece.level, offsetY);
}

function drawMergeAnimations() {
  const now = performance.now();

  for (let i = mergeAnimations.length - 1; i >= 0; i--) {
    const anim = mergeAnimations[i];
    const tRaw = (now - anim.startTime) / anim.duration;

    if (tRaw >= 1) {
      mergeAnimations.splice(i, 1);
      continue;
    }

    const t = 1 - Math.pow(1 - Math.max(0, Math.min(1, tRaw)), 3);
    const currentY = anim.from.y + (anim.to.y - anim.from.y) * t;
    const centerX = anim.from.x * BLOCK_SIZE + BLOCK_SIZE / 2;
    const centerY = currentY * BLOCK_SIZE + BLOCK_SIZE / 2;
    const scale = 1 - 0.24 * t;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1 - 0.75 * t;
    ctx.fillStyle = CURRENT_THEME[anim.level];
    ctx.fillRect(-BLOCK_SIZE / 2 + 3, -BLOCK_SIZE / 2 + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
    ctx.restore();
  }
}

function render() {
  drawGridBackground();
  drawNextPiecePreview();
  drawBoard();
  drawLineClearAnimations();
  drawMergeAnimations();
  drawCurrentPiece();
}

function update(time) {
  if (!gameStarted || (!isPaused && !isGameOver)) {
    if (!gameStarted) {
      render();
      requestAnimationFrame(update);
      return;
    }

    if (!lastDropTime) {
      lastDropTime = time;
    }

    if (gameMode === "quick" && timerStart) {
      const prevSeconds = elapsedSeconds;
      elapsedSeconds = Math.floor((time - timerStart) / 1000);
      if (elapsedSeconds !== prevSeconds) {
        const m = Math.floor(elapsedSeconds / 60);
        const s = elapsedSeconds % 60;
        timerText.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      }
    }

    if (isCurrentPieceMorphing(time)) {
      currentFallProgress = 0;
      lastDropTime = time;
    } else {
      const activeDropInterval = isSoftDropping ? SOFT_DROP_INTERVAL : dropInterval;
      const delta = time - lastDropTime;
      currentFallProgress = Math.max(0, Math.min(1, delta / activeDropInterval));
      updateNextPreviewVisibility(time);

      if (delta >= activeDropInterval) {
        tryMoveDownWithMerge();
        lastDropTime = time;
        currentFallProgress = 0;
      }
    }
  }

  if (gameMode === "quick" && score >= quickTargetScore && !isGameOver) {
    triggerGameOver(true);
  }

  render();
  requestAnimationFrame(update);
}

function movePiece(dx) {
  if (isPaused || isGameOver || !currentPiece) {
    return;
  }

  if (!collision(currentPiece, dx, 0)) {
    currentPiece.x += dx;
  }
}

function setSoftDropping(active) {
  if (isPaused || isGameOver || !currentPiece) {
    return;
  }

  if (isSoftDropping === active) {
    return;
  }

  const now = performance.now();
  const currentInterval = isSoftDropping ? SOFT_DROP_INTERVAL : dropInterval;
  const nextInterval = active ? SOFT_DROP_INTERVAL : dropInterval;
  const elapsed = Math.max(0, now - lastDropTime);
  const progress = Math.max(0, Math.min(1, elapsed / currentInterval));

  isSoftDropping = active;
  lastDropTime = now - progress * nextInterval;
  currentFallProgress = progress;
}

function togglePause() {
  if (isGameOver) {
    return;
  }

  isPaused = !isPaused;
  if (isPaused) {
    isSoftDropping = false;
  }

  if (isPaused) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "暂停";
    overlaySubtitle.textContent = "";
    statusText.textContent = "已暂停";
    restartBtn.classList.add("hidden");
    continueBtn.classList.remove("hidden");
    exitBtn.classList.remove("hidden");
  } else {
    overlay.classList.add("hidden");
    statusText.textContent = "进行中";
    continueBtn.classList.add("hidden");
    exitBtn.classList.add("hidden");
  }
}

function openSettings() {
  settingsPanel.classList.remove("hidden");
  settingsPanel.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  settingsPanel.classList.add("hidden");
  settingsPanel.setAttribute("aria-hidden", "true");
}

function pickRandomTheme() {
  const keys = Object.keys(PALETTES);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  CURRENT_THEME = PALETTES[randomKey];
}

function showModeSelect() {
  modeSelect.classList.remove("hidden");
  quickScoreSelect.classList.toggle("hidden", selectedGameMode !== "quick");
}

function hideModeSelect() {
  modeSelect.classList.add("hidden");
  quickScoreSelect.classList.add("hidden");
}

function showQuickScoreSelect() {
  selectedGameMode = "quick";
  modeEndless.classList.remove("selected");
  modeQuick.classList.add("selected");
  quickScoreSelect.classList.remove("hidden");
}

function selectQuickTargetScore(targetScore, button) {
  quickTargetScore = targetScore;
  setSelectedButton(quickScoreSelect, "[data-score]", button);
  quickCustomStart.classList.remove("selected");
}

function selectCustomQuickScore() {
  quickCustomInput.setCustomValidity("");
  quickScoreSelect.querySelectorAll("[data-score]").forEach((button) => {
    button.classList.remove("selected");
  });
  quickCustomStart.classList.add("selected");
}

function selectGameMode(mode) {
  selectedGameMode = mode;
  modeEndless.classList.toggle("selected", mode === "endless");
  modeQuick.classList.toggle("selected", mode === "quick");
  quickScoreSelect.classList.toggle("hidden", mode !== "quick");
}

function selectAreaSize(cols, button) {
  selectedCols = cols;
  setSelectedButton(areaSizeOptions, ".setup-option", button);
}

function selectSpeed(speedMultiplier, button) {
  selectedSpeedMultiplier = speedMultiplier;
  setSelectedButton(speedOptions, ".setup-option", button);
}

function startConfiguredGame() {
  if (selectedGameMode === "quick" && quickCustomStart.classList.contains("selected")) {
    const customScore = Number(quickCustomInput.value);
    if (!Number.isFinite(customScore) || customScore <= 25) {
      quickCustomInput.setCustomValidity("自定义分数需要大于 25");
      quickCustomInput.reportValidity();
      return;
    }
    quickTargetScore = Math.floor(customScore);
  }

  configureBoardSize(selectedCols);
  dropInterval = BASE_DROP_INTERVAL / selectedSpeedMultiplier;
  startGameWithMode(selectedGameMode);
}

function startGameWithMode(mode) {
  gameMode = mode;
  if (mode !== "quick") {
    quickTargetScore = 25;
  }
  pickRandomTheme();
  hideModeSelect();
  startPage.classList.add("hidden");
  gameStarted = true;
  isGameOver = false;
  isPaused = false;
  isSoftDropping = false;
  lastDropTime = 0;
  currentFallProgress = 0;
  mergeAnimations.length = 0;
  lineClearAnimations.length = 0;
  board = createEmptyBoard();
  score = 0;
  elapsedSeconds = 0;
  timerStart = 0;
  nextPieceLevel = randomLevel();
  nextPreviewMorph = null;
  nextPreviewVisible = false;
  nextPreviewRevealStart = 0;
  updateScore();

  if (mode === "quick") {
    timerDisplay.classList.remove("hidden");
    timerText.textContent = "00:00";
    timerStart = performance.now();
  } else {
    timerDisplay.classList.add("hidden");
  }

  statusText.textContent = "进行中";
  overlay.classList.add("hidden");
  restartBtn.classList.add("hidden");
  continueBtn.classList.add("hidden");
  exitBtn.classList.add("hidden");
  spawnNewPiece();
  lastDropTime = performance.now();
}

function startGame() {
  showModeSelect();
}

document.addEventListener("keydown", (event) => {
  if (!settingsPanel.classList.contains("hidden") && event.key === "Escape") {
    event.preventDefault();
    closeSettings();
    return;
  }

  if (!modeSelect.classList.contains("hidden") && event.key === "Escape") {
    event.preventDefault();
    hideModeSelect();
    return;
  }

  if (!gameStarted) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      movePiece(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      movePiece(1);
      break;
    case "ArrowDown":
      event.preventDefault();
      setSoftDropping(true);
      break;
    case "Escape":
      event.preventDefault();
      togglePause();
      break;
  }
});

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    setSoftDropping(false);
  }
});

restartBtn.addEventListener("click", restartGame);
continueBtn.addEventListener("click", () => {
  if (isPaused && !isGameOver) {
    togglePause();
  }
});
exitBtn.addEventListener("click", exitGame);
startBtn.addEventListener("click", startGame);
startSettingsBtn.addEventListener("click", openSettings);
settingsBtn.addEventListener("click", openSettings);

modeEndless.addEventListener("click", () => selectGameMode("endless"));
modeQuick.addEventListener("click", showQuickScoreSelect);
quickScoreSelect.querySelectorAll("[data-score]").forEach((button) => {
  button.addEventListener("click", () => selectQuickTargetScore(Number(button.dataset.score), button));
});
quickCustomStart.addEventListener("click", selectCustomQuickScore);
quickCustomInput.addEventListener("input", () => {
  quickCustomInput.setCustomValidity("");
  selectCustomQuickScore();
});
areaSizeOptions.querySelectorAll("[data-cols]").forEach((button) => {
  button.addEventListener("click", () => selectAreaSize(Number(button.dataset.cols), button));
});
speedOptions.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => selectSpeed(Number(button.dataset.speed), button));
});
setupStartBtn.addEventListener("click", startConfiguredGame);

settingsBackdrop.addEventListener("click", closeSettings);

document.querySelector(".mode-select-backdrop").addEventListener("click", hideModeSelect);

tabRules.addEventListener("click", () => {
  tabRules.classList.add("active");
  tabControls.classList.remove("active");
  rulesContent.classList.add("active");
  controlsContent.classList.remove("active");
});

tabControls.addEventListener("click", () => {
  tabControls.classList.add("active");
  tabRules.classList.remove("active");
  controlsContent.classList.add("active");
  rulesContent.classList.remove("active");
});

function init() {
  configureBoardSize(COLS);
  statusText.textContent = "就绪";
  updateScore();
  render();
  requestAnimationFrame(update);
}

init();
