import { THEMES } from "../shared/themes.js";

function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

const MERGE_ANIMATION_MS = 140;
const LINE_CLEAR_ANIMATION_MS = 220;
const NEXT_PREVIEW_INSET = 4;
const NEXT_PREVIEW_HEIGHT = 10;
const NEXT_PREVIEW_MORPH_MS = 260;
const NEXT_PREVIEW_REVEAL_MS = 180;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function mixHex(hex, target, amount) {
  const source = hex.replace("#", "");
  const targetHex = target.replace("#", "");
  const sourceRgb = [0, 2, 4].map((index) => parseInt(source.slice(index, index + 2), 16));
  const targetRgb = [0, 2, 4].map((index) => parseInt(targetHex.slice(index, index + 2), 16));
  const mixed = sourceRgb.map((value, index) => {
    const next = Math.round(value + (targetRgb[index] - value) * amount);
    return next.toString(16).padStart(2, "0");
  });
  return `#${mixed.join("")}`;
}

export function computeBoardLayout({ width, height, rows, cols, blockAspect = 1 }) {
  const boardWidth = width;
  const boardHeight = height;
  const gapX = 0;
  const gapY = 0;
  const cellWidth = boardWidth / cols;
  const cellHeight = boardHeight / rows;

  return {
    boardX: 0,
    boardY: 0,
    boardWidth,
    boardHeight,
    rows,
    cols,
    gapX,
    gapY,
    cellWidth,
    cellHeight,
    blockAspect,
  };
}

export function createCanvasRenderer(theme = THEMES.leaf) {
  let ctx = null;
  let layout = null;
  let pixelRatio = 1;
  let seenEventKeys = new Set();
  let mergeAnimations = [];
  let lineClearAnimations = [];
  let nextPreviewVisible = false;
  let nextPreviewRevealStart = 0;
  let nextPreviewMorph = null;
  let hasShownNextPreview = false;

  function resize({ context, width, height, ratio = 1, rows, cols }) {
    ctx = context;
    pixelRatio = ratio || 1;

    layout = computeBoardLayout({ width, height, rows, cols, blockAspect: 1 });
  }

  function clear() {
    if (!ctx || !layout) {
      return;
    }
    ctx.clearRect(0, 0, layout.boardWidth, layout.boardHeight);
  }

  function cellRect(x, y, offsetRows = 0) {
    const inset = Math.max(2, Math.min(3, layout.cellWidth * 0.06));
    const cellX = layout.boardX + x * layout.cellWidth;
    const cellY = layout.boardY + (y + offsetRows) * layout.cellHeight;
    const blockWidth = Math.max(0, layout.cellWidth - inset * 2);
    const blockHeight = Math.max(0, layout.cellHeight - inset * 2);

    return {
      x: cellX + inset,
      y: cellY + inset,
      width: blockWidth,
      height: blockHeight,
      inset,
    };
  }

  function fillRounded(rect, color, radius) {
    ctx.fillStyle = color;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(rect.x + 2, rect.y + 2, Math.max(0, rect.width - 12), Math.min(8, rect.height / 4));
  }

  function eventKey(event) {
    const from = event.from ? `${event.from.x},${event.from.y}` : "";
    const to = event.to ? `${event.to.x},${event.to.y}` : "";
    const piece = event.piece ? `${event.piece.x},${event.piece.y},${event.piece.level}` : "";
    return `${event.at || 0}:${event.type}:${from}:${to}:${piece}:${event.y ?? ""}:${event.level ?? ""}`;
  }

  function ingestEvents(snapshot, now) {
    const events = snapshot.events || [];
    for (const event of events) {
      const key = eventKey(event);
      if (seenEventKeys.has(key)) {
        continue;
      }
      seenEventKeys.add(key);

      if (event.type === "merge" && event.from && event.to) {
        mergeAnimations.push({
          from: event.from,
          to: event.to,
          level: event.level,
          startTime: now,
          duration: MERGE_ANIMATION_MS,
        });
      }

      if (event.type === "lineClear") {
        lineClearAnimations.push({
          y: event.y,
          level: event.level,
          startTime: now,
          duration: LINE_CLEAR_ANIMATION_MS,
        });
      }

      if (event.type === "spawn") {
        if (event.piece && hasShownNextPreview) {
          nextPreviewMorph = {
            level: event.piece.level,
            targetColumn: event.piece.x,
            startTime: now,
            duration: NEXT_PREVIEW_MORPH_MS,
          };
        }
        nextPreviewVisible = false;
        nextPreviewRevealStart = 0;
      }
    }

    if (seenEventKeys.size > 80) {
      seenEventKeys = new Set(Array.from(seenEventKeys).slice(-40));
    }
  }

  function drawCell(x, y, level, offsetRows = 0) {
    const rect = cellRect(x, y, offsetRows);
    fillRounded(rect, theme.blocks[level] || theme.blocks[theme.blocks.length - 1], 6);
  }

  function drawGrid() {
    const gradient = ctx.createLinearGradient(0, 0, 0, layout.boardHeight);
    gradient.addColorStop(0, "#42545f");
    gradient.addColorStop(1, "#29343d");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, layout.boardWidth, layout.boardHeight);
  }

  function drawNextPiecePreview(snapshot, now) {
    const next = snapshot.nextPiece;
    if (!next) {
      return;
    }

    const currentTop = snapshot.currentPiece
      ? (snapshot.currentPiece.y + snapshot.currentPiece.fallProgress) * layout.cellHeight
      : Infinity;
    if (!nextPreviewVisible && currentTop > layout.cellHeight) {
      nextPreviewVisible = true;
      hasShownNextPreview = true;
      nextPreviewRevealStart = now;
    }

    if (!nextPreviewVisible) {
      return;
    }

    const revealT = nextPreviewRevealStart
      ? Math.max(0, Math.min(1, (now - nextPreviewRevealStart) / NEXT_PREVIEW_REVEAL_MS))
      : 1;
    const revealEase = easeOutCubic(revealT);
    const x = NEXT_PREVIEW_INSET;
    const y = lerp(0, NEXT_PREVIEW_INSET, revealEase);
    const width = Math.max(0, layout.boardWidth - NEXT_PREVIEW_INSET * 2);
    const color = theme.blocks[next.level] || theme.blocks[0];

    ctx.save();
    ctx.globalAlpha = revealEase;
    ctx.fillStyle = color;
    roundedRect(ctx, x, y, width, NEXT_PREVIEW_HEIGHT, NEXT_PREVIEW_HEIGHT / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(x + 2, y + 2, Math.max(0, width - 4), 2);
    ctx.restore();
  }

  function drawNextPreviewMorph(now) {
    if (!nextPreviewMorph) {
      return;
    }

    const rawT = Math.max(0, Math.min(1, (now - nextPreviewMorph.startTime) / nextPreviewMorph.duration));
    if (rawT >= 1) {
      nextPreviewMorph = null;
      return;
    }

    const eased = easeOutCubic(rawT);
    const barX = NEXT_PREVIEW_INSET;
    const barY = NEXT_PREVIEW_INSET;
    const barWidth = Math.max(0, layout.boardWidth - NEXT_PREVIEW_INSET * 2);
    const target = cellRect(nextPreviewMorph.targetColumn, 0);
    const width = lerp(barWidth, target.width, eased);
    const height = lerp(NEXT_PREVIEW_HEIGHT, target.height, eased);
    const x = lerp(barX, target.x, eased);
    const y = lerp(barY, target.y, eased);
    const radius = lerp(NEXT_PREVIEW_HEIGHT / 2, 2, eased);

    ctx.save();
    ctx.globalAlpha = 1 - 0.15 * eased;
    ctx.fillStyle = theme.blocks[nextPreviewMorph.level] || theme.blocks[0];
    roundedRect(ctx, x, y, width, height, radius);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(x + 2, y + 2, Math.max(0, width - 14), Math.min(8, height / 4));
    ctx.restore();
  }

  function currentPieceIsMorphing(snapshot, now) {
    if (!nextPreviewMorph || !snapshot.currentPiece) {
      return false;
    }

    const samePiece = snapshot.currentPiece.x === nextPreviewMorph.targetColumn
      && snapshot.currentPiece.level === nextPreviewMorph.level;
    return samePiece && now - nextPreviewMorph.startTime < nextPreviewMorph.duration;
  }

  function drawLineClearAnimations(now) {
    for (let index = lineClearAnimations.length - 1; index >= 0; index -= 1) {
      const anim = lineClearAnimations[index];
      const rawT = (now - anim.startTime) / anim.duration;
      if (rawT >= 1) {
        lineClearAnimations.splice(index, 1);
        continue;
      }

      const t = easeOutCubic(rawT);
      const inset = Math.max(2, Math.min(3, layout.cellWidth * 0.06));
      const fullWidth = Math.max(0, layout.cellWidth - inset * 2);
      const fullHeight = Math.max(0, layout.cellHeight - inset * 2);
      const height = lerp(fullHeight, 4, t);
      const alpha = rawT < 0.72 ? 1 : 1 - (rawT - 0.72) / 0.28;
      const y = anim.y * layout.cellHeight + inset + fullHeight - height;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      for (let xIndex = 0; xIndex < layout.cols; xIndex += 1) {
        const x = xIndex * layout.cellWidth + inset;
        ctx.fillStyle = theme.blocks[anim.level] || theme.blocks[0];
        ctx.fillRect(x, y, fullWidth, height);
        if (height > 8) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
          ctx.fillRect(x + 2, y + 2, Math.max(0, fullWidth - 14), Math.min(8, height / 4));
        }
      }
      ctx.restore();
    }
  }

  function drawMergeAnimations(now) {
    for (let index = mergeAnimations.length - 1; index >= 0; index -= 1) {
      const anim = mergeAnimations[index];
      const rawT = (now - anim.startTime) / anim.duration;
      if (rawT >= 1) {
        mergeAnimations.splice(index, 1);
        continue;
      }

      const t = easeOutCubic(rawT);
      const currentY = anim.from.y + (anim.to.y - anim.from.y) * t;
      const rect = cellRect(anim.from.x, currentY);
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const scale = 1 - 0.24 * t;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.globalAlpha = 1 - 0.75 * t;
      ctx.fillStyle = theme.blocks[anim.level] || theme.blocks[0];
      ctx.fillRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
      ctx.restore();
    }
  }

  function draw(snapshot) {
    if (!ctx || !layout) {
      return;
    }
    const now = Date.now();
    ingestEvents(snapshot, now);

    if (layout.cols !== snapshot.config.cols || layout.rows !== snapshot.config.rows) {
      layout = computeBoardLayout({
        width: layout.boardWidth,
        height: layout.boardHeight,
        rows: snapshot.config.rows,
        cols: snapshot.config.cols,
      });
    }

    clear();
    drawGrid();
    drawNextPiecePreview(snapshot, now);
    drawNextPreviewMorph(now);

    snapshot.board.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(x, y, cell.level);
        }
      });
    });

    drawLineClearAnimations(now);
    drawMergeAnimations(now);

    if (snapshot.currentPiece && !currentPieceIsMorphing(snapshot, now)) {
      drawCell(
        snapshot.currentPiece.x,
        snapshot.currentPiece.y,
        snapshot.currentPiece.level,
        snapshot.currentPiece.fallProgress,
      );
    }

  }

  function destroy() {
    ctx = null;
    layout = null;
  }

  return { resize, draw, destroy };
}
