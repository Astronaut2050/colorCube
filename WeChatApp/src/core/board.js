export function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function isInsideBoard({ rows, cols }, x, y) {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

export function hasCollision(board, piece, dx, dy) {
  const rows = board.length;
  const cols = board[0]?.length || 0;
  const x = piece.x + dx;
  const y = piece.y + dy;

  if (x < 0 || x >= cols || y >= rows) {
    return true;
  }

  if (y < 0) {
    return false;
  }

  return Boolean(board[y][x]);
}

export function applyColumnStep(board, x) {
  const rows = board.length;
  let changed = false;

  for (let y = rows - 2; y >= 0; y -= 1) {
    const cell = board[y][x];
    if (!cell) {
      continue;
    }

    let targetY = y;
    while (targetY + 1 < rows && !board[targetY + 1][x]) {
      targetY += 1;
    }

    const below = targetY + 1 < rows ? board[targetY + 1][x] : null;
    if (below && below.level === cell.level) {
      board[y][x] = null;
      below.level += 1;
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
