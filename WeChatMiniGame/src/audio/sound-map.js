const AUDIO_BASE = "assets/audio";

export const SOUND_MAP = {
  ui_start: {
    src: `${AUDIO_BASE}/ui_start.wav`,
    volume: 0.68,
    cooldownMs: 180,
  },
  ui_tap: {
    src: `${AUDIO_BASE}/ui_tap.wav`,
    volume: 0.42,
    cooldownMs: 70,
  },
  ui_select: {
    src: `${AUDIO_BASE}/ui_select.wav`,
    volume: 0.5,
    cooldownMs: 90,
  },
  next_drop: {
    // Temporary mapping: the current asset batch does not include next_drop.wav.
    src: `${AUDIO_BASE}/piece_soft_drop.wav`,
    volume: 0.5,
    cooldownMs: 220,
  },
  piece_move: {
    src: `${AUDIO_BASE}/piece_move.wav`,
    volume: 0.38,
    cooldownMs: 40,
  },
  piece_blocked: {
    src: `${AUDIO_BASE}/piece_blocked.wav`,
    volume: 0.36,
    cooldownMs: 100,
  },
  piece_soft_drop: {
    src: `${AUDIO_BASE}/piece_soft_drop.wav`,
    volume: 0.46,
    cooldownMs: 120,
  },
  piece_lock: {
    src: `${AUDIO_BASE}/piece_lock.wav`,
    volume: 0.5,
    cooldownMs: 80,
  },
  piece_merge: {
    src: `${AUDIO_BASE}/piece_merge.wav`,
    volume: 0.66,
    cooldownMs: 60,
  },
  line_clear: {
    src: `${AUDIO_BASE}/line_clear.wav`,
    volume: 0.78,
    cooldownMs: 120,
  },
  game_win: {
    src: `${AUDIO_BASE}/game_win.wav`,
    volume: 0.78,
    cooldownMs: 1000,
  },
  game_over: {
    src: `${AUDIO_BASE}/game_over.wav`,
    volume: 0.7,
    cooldownMs: 1000,
  },
};
