const COLS = 7;
const ROWS = 11;
const BLOCK_SIZE = 52;

const GREEN_LEVELS = [
  "#eef3d8",
  "#d4deb1",
  "#aebc84",
  "#7f8f5b",
  "#55633d",
];

const LEVEL_SCORES = [1, 2, 3, 4, 5];

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const startPage = document.getElementById("start-page");
const startBtn = document.getElementById("start-btn");
const startSettingsBtn = document.getElementById("start-settings-btn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const restartBtn = document.getElementById("restart-btn");
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
let dropInterval = 520;
let lastDropTime = 0;
let isPaused = false;
let isGameOver = false;
let gameStarted = false;
let currentFallProgress = 0;

const mergeAnimations = [];

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomLevel() {
  return Math.floor(Math.random() * 2);
}

function createPiece() {
  return {
    x: Math.floor(COLS / 2),
    y: -1,
    level: randomLevel(),
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
  currentPiece = createPiece();
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
    return;
  }

  if (belowCell && belowCell.level === currentPiece.level) {
    mergeIntoCell(currentPiece.x, currentPiece.y, nextY, currentPiece.level);
  } else {
    lockPieceToBoard();
  }

  resolveBoardState();
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
      duration: 220,
    });
  }

  score += LEVEL_SCORES[level];
  board[toY][x].level = Math.min(board[toY][x].level + 1, GREEN_LEVELS.length - 1);
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

  for (let y = ROWS - 2; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (!cell) {
        continue;
      }

      const below = board[y + 1][x];

      if (!below) {
        board[y + 1][x] = cell;
        board[y][x] = null;
        changed = true;
        continue;
      }

      if (below.level === cell.level) {
        mergeIntoCell(x, y, y + 1, cell.level);
        board[y][x] = null;
        changed = true;
      }
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

    for (let yy = y; yy > 0; yy--) {
      board[yy] = [...board[yy - 1]];
    }
    board[0] = Array(COLS).fill(null);
    cleared = true;
    y += 1;
  }

  return cleared;
}

function resolveBoardState() {
  let changed = false;
  let guard = 0;

  do {
    const movedOrMerged = applyBoardStep();
    const lineCleared = clearLines();
    changed = movedOrMerged || lineCleared;
    guard += 1;
  } while (changed && guard < ROWS * 4);
}

function triggerGameOver() {
  isGameOver = true;
  isPaused = true;
  currentFallProgress = 0;
  statusText.textContent = "已结束";
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "游戏结束";
  overlaySubtitle.textContent = "方块已经堆到顶部";
  restartBtn.classList.remove("hidden");
}

function restartGame() {
  board = createEmptyBoard();
  score = 0;
  isGameOver = false;
  isPaused = false;
  gameStarted = false;
  currentFallProgress = 0;
  lastDropTime = 0;
  mergeAnimations.length = 0;
  statusText.textContent = "就绪";
  overlay.classList.add("hidden");
  restartBtn.classList.add("hidden");
  startPage.classList.remove("hidden");
  updateScore();
  render();
}

function updateScore() {
  scoreEl.textContent = String(score);
}

function drawCell(x, y, level, offsetY = 0) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE + offsetY;

  ctx.fillStyle = GREEN_LEVELS[level];
  ctx.fillRect(px + 3, py + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);

  ctx.strokeStyle = "rgba(24, 32, 38, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 3, py + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(px + 5, py + 5, BLOCK_SIZE - 18, 8);
}

function drawGridBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#42545f");
  gradient.addColorStop(1, "#29343d");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(240, 245, 242, 0.14)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK_SIZE + 0.5, 0);
    ctx.lineTo(x * BLOCK_SIZE + 0.5, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK_SIZE + 0.5);
    ctx.lineTo(canvas.width, y * BLOCK_SIZE + 0.5);
    ctx.stroke();
  }
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

function drawCurrentPiece() {
  if (!currentPiece || currentPiece.y < 0) {
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
    ctx.fillStyle = GREEN_LEVELS[anim.level];
    ctx.fillRect(-BLOCK_SIZE / 2 + 3, -BLOCK_SIZE / 2 + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
    ctx.restore();
  }
}

function render() {
  drawGridBackground();
  drawBoard();
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

    const delta = time - lastDropTime;
    currentFallProgress = Math.max(0, Math.min(1, delta / dropInterval));

    if (delta >= dropInterval) {
      tryMoveDownWithMerge();
      lastDropTime = time;
      currentFallProgress = 0;
    }
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

function softDrop() {
  if (isPaused || isGameOver || !currentPiece) {
    return;
  }

  tryMoveDownWithMerge();
  lastDropTime = performance.now();
  currentFallProgress = 0;
}

function togglePause() {
  if (isGameOver) {
    return;
  }

  isPaused = !isPaused;

  if (isPaused) {
    overlay.classList.remove("hidden");
    overlayTitle.textContent = "暂停";
    overlaySubtitle.textContent = "按 ESC 继续游戏";
    statusText.textContent = "已暂停";
  } else {
    overlay.classList.add("hidden");
    statusText.textContent = "进行中";
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

function startGame() {
  gameStarted = true;
  startPage.classList.add("hidden");
  statusText.textContent = "进行中";
  isGameOver = false;
  isPaused = false;
  lastDropTime = 0;
  currentFallProgress = 0;
  mergeAnimations.length = 0;
  board = createEmptyBoard();
  score = 0;
  updateScore();
  overlay.classList.add("hidden");
  restartBtn.classList.add("hidden");
  spawnNewPiece();
  lastDropTime = performance.now();
}

document.addEventListener("keydown", (event) => {
  if (!settingsPanel.classList.contains("hidden") && event.key === "Escape") {
    event.preventDefault();
    closeSettings();
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
      softDrop();
      break;
    case "Escape":
      event.preventDefault();
      togglePause();
      break;
  }
});

restartBtn.addEventListener("click", restartGame);
startBtn.addEventListener("click", startGame);
startSettingsBtn.addEventListener("click", openSettings);
settingsBtn.addEventListener("click", openSettings);

settingsBackdrop.addEventListener("click", closeSettings);

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
  canvas.width = COLS * BLOCK_SIZE;
  canvas.height = ROWS * BLOCK_SIZE;
  statusText.textContent = "就绪";
  updateScore();
  render();
  requestAnimationFrame(update);
}

init();
