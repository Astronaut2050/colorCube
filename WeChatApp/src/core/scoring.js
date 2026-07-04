export const LEVEL_SCORES = [1, 2, 3, 4, 5];
export const MAX_LEVEL = LEVEL_SCORES.length - 1;

export function scoreForLevel(level) {
  return LEVEL_SCORES[Math.max(0, Math.min(MAX_LEVEL, level))];
}

export function scoreForLine(cols, level) {
  return cols * scoreForLevel(level);
}
