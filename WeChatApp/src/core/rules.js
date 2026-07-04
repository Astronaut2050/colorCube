import { applyColumnStep } from "./board.js";
import { MAX_LEVEL, scoreForLevel, scoreForLine } from "./scoring.js";

export function mergeIntoCell(board, x, fromY, toY, level) {
  const target = board[toY]?.[x];
  if (!target) {
    return { score: 0, events: [] };
  }

  target.level = Math.min(MAX_LEVEL, target.level + 1);

  return {
    score: scoreForLevel(level),
    events: [{ type: "merge", from: { x, y: fromY }, to: { x, y: toY }, level }],
  };
}

export function clearLines(board) {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  let score = 0;
  const events = [];
  let cleared = false;

  for (let y = rows - 1; y >= 0; y -= 1) {
    const firstLevel = board[y][0]?.level;
    if (firstLevel === undefined) {
      continue;
    }

    const fullSameLine = board[y].every((cell) => cell && cell.level === firstLevel);
    if (!fullSameLine) {
      continue;
    }

    events.push({ type: "lineClear", y, level: firstLevel });
    score += scoreForLine(cols, firstLevel);
    cleared = true;

    for (let yy = y; yy > 0; yy -= 1) {
      board[yy] = board[yy - 1].map((cell) => (cell ? { ...cell } : null));
    }
    board[0] = Array(cols).fill(null);
    y += 1;
  }

  return { changed: cleared, score, events };
}

export function resolveBoardState(board, startColumn = null) {
  const cols = board[0]?.length || 0;
  let score = 0;
  let changed = false;
  const events = [];
  let guard = 0;
  let activeColumns = startColumn === null
    ? Array.from({ length: cols }, (_, index) => index)
    : [startColumn];

  while (guard < 100) {
    guard += 1;
    let movedOrMerged = false;

    for (const x of activeColumns) {
      if (applyColumnStep(board, x)) {
        movedOrMerged = true;
      }
    }

    const lineResult = clearLines(board);
    if (lineResult.changed) {
      changed = true;
      score += lineResult.score;
      events.push(...lineResult.events);
      activeColumns = Array.from({ length: cols }, (_, index) => index);
      continue;
    }

    if (!movedOrMerged) {
      break;
    }

    changed = true;
  }

  return { changed, score, events };
}
