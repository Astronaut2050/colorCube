import { createGame } from './src/core/game.js';
import { createCanvasRenderer } from './src/renderers/canvas-renderer.js';
import { createGameLifecycle } from './src/platforms/wechat/lifecycle.js';
import { DEFAULT_GAME_OPTIONS, GAME_NAME, COLUMN_OPTIONS, SPEED_OPTIONS } from './src/shared/constants.js';
import { pickTheme } from './src/shared/themes.js';

// ====== Canvas setup ======
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const sysInfo = wx.getSystemInfoSync();
const W = sysInfo.windowWidth;
const H = sysInfo.windowHeight;
const PR = sysInfo.pixelRatio || 1;

canvas.width = W * PR;
canvas.height = H * PR;
ctx.scale(PR, PR);

// ====== Constants ======
const BTN_RADIUS = 20;
const CARD_RADIUS = 20;
const MODE_SELECT_PADDING = 24;
const SETTINGS_TAB_RADIUS = 10;

// ====== State ======
let currentScreen = 'home';
let game = createGame();
let lifecycle = createGameLifecycle(game);
let renderer = null;
let settings = { ...DEFAULT_GAME_OPTIONS };
let theme = pickTheme();
let snapshot = game.getSnapshot();
let animationHandle = null;
let canvasReady = false;
let scoreBump = false;
let prevScore = 0;
let settingsTab = 'rules';
let settingsFromGame = false;
let useCustomQuickScore = false;
let customQuickScore = '30';
let customScoreInputActive = false;

// ====== Utility functions ======
function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function isInRect(tx, ty, rect) {
  return tx >= rect.x && tx <= rect.x + rect.w && ty >= rect.y && ty <= rect.y + rect.h;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function measureText(text, fontSize) {
  ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  return ctx.measureText(text).width;
}

function drawButtonSolid(label, x, y, w, h, radius, bgColor, textColor, fontSize) {
  fontSize = fontSize || 17;
  drawRoundedRect(ctx, x, y, w, h, radius || BTN_RADIUS);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.fillStyle = textColor || '#faf7f2';
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function drawButtonGradient(label, x, y, w, h, radius, gradStart, gradEnd, textColor, fontSize) {
  fontSize = fontSize || 17;
  drawRoundedRect(ctx, x, y, w, h, radius || BTN_RADIUS);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, gradStart);
  grad.addColorStop(1, gradEnd);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.fillStyle = textColor || '#faf7f2';
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2);
}

function drawSegmentedOption(label, x, y, w, h, selected) {
  drawRoundedRect(ctx, x, y, w, h, 14);
  if (selected) {
    ctx.fillStyle = 'rgba(143, 159, 136, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#8f9f88';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(88, 84, 80, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#243038';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), x + w / 2, y + h / 2);
}

// ====== Board layout calculation ======
const BOARD_ASPECT = 11 / 4;
const TOP_BAR_H = 52;
const GAME_PADDING = 8;
const GAP = 18;

function calcBoardLayout() {
  const availW = Math.max(260, W - 16);
  const safeB = sysInfo.safeArea ? Math.max(0, H - sysInfo.safeArea.bottom) : 0;
  const availH = Math.max(320, H - 112 - TOP_BAR_H - safeB - GAP);
  const cols = snapshot.config.cols || 4;
  const rows = snapshot.config.rows || 11;
  const aspect = rows / cols;
  let bw = Math.min(availW, cols * 52);
  let bh = bw * aspect;
  if (bh > availH) {
    bh = availH;
    bw = bh / aspect;
  }
  bw = Math.floor(Math.max(220, bw));
  bh = Math.floor(bw * aspect);
  return { bw, bh, cols, rows, cellW: bw / cols, cellH: bh / rows };
}

// ====== Touch state for UI buttons ======
let touchButtons = [];

function clearTouchButtons() {
  touchButtons = [];
}

function addTouchBtn(id, rect) {
  touchButtons.push({ id, rect });
}

function hitTest(tx, ty) {
  for (let i = touchButtons.length - 1; i >= 0; i--) {
    if (isInRect(tx, ty, touchButtons[i].rect)) {
      return touchButtons[i].id;
    }
  }
  return null;
}

// ====== Screen Renderers ======
function drawHomeScreen() {
  ctx.clearRect(0, 0, W, H);
  clearTouchButtons();

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d7d0c6');
  grad.addColorStop(1, '#c7beb2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const contentW = Math.min(360, W - 48);
  const cx = (W - contentW) / 2;
  let cy = H * 0.35;

  // Title
  ctx.fillStyle = '#243038';
  ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(GAME_NAME, W / 2, cy);
  cy += 36;

  // Subtitle
  ctx.fillStyle = '#756c64';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('轻松休闲的融合消除游戏', W / 2, cy);
  cy += 40;

  // Start button
  const btnW = contentW;
  const btnH = 48;
  let btnY = cy + 10;
  addTouchBtn('start', { x: cx, y: btnY, w: btnW, h: btnH });
  drawButtonGradient('开始游戏', cx, btnY, btnW, btnH, BTN_RADIUS,
    '#8f9f88', '#6f806a', '#faf7f2', 17);

  // Guide button
  btnY += btnH + 12;
  addTouchBtn('settings_controls', { x: cx, y: btnY, w: btnW, h: btnH });
  drawRoundedRect(ctx, cx, btnY, btnW, btnH, BTN_RADIUS);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(88, 84, 80, 0.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#4e4944';
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏指引', W / 2, btnY + btnH / 2);
}

function drawSetupScreen() {
  ctx.clearRect(0, 0, W, H);
  clearTouchButtons();

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#d7d0c6');
  grad.addColorStop(1, '#c7beb2');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(393, W) - MODE_SELECT_PADDING * 2;
  const cx = (W - cardW) / 2;
  const safeB = sysInfo.safeArea ? Math.max(0, H - sysInfo.safeArea.bottom) : 0;
  const firstCardH = settings.mode === 'quick' ? (useCustomQuickScore ? 360 : 306) : 184;
  const secondCardH = 316;
  const cardGap = 16;
  const totalH = firstCardH + cardGap + secondCardH;
  let cy = Math.max(24, Math.min(128, Math.floor((H - safeB - totalH) / 2)));

  // Mode selection card
  drawSetupBlock(cx, cy, cardW, firstCardH, () => {
    let by = cy + 26;
    ctx.fillStyle = '#243038';
    ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('选择模式', cx + 26, by);
    by += 36;

    // Mode buttons
    const modeGap = 16;
    const modeBtnW = (cardW - 26 * 2 - modeGap) / 2;
    const modeBtnH = 86;
    const modeY = by;

    addTouchBtn('mode_endless', { x: cx + 26, y: modeY, w: modeBtnW, h: modeBtnH });
    drawRoundedRect(ctx, cx + 26, modeY, modeBtnW, modeBtnH, 16);
    if (settings.mode === 'endless') {
      ctx.fillStyle = 'rgba(143, 159, 136, 0.18)';
      ctx.fill();
      ctx.strokeStyle = '#8f9f88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(88, 84, 80, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#243038';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('无限模式', cx + 26 + modeBtnW / 2, modeY + 30);
    ctx.fillStyle = '#756c64';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('自由畅玩', cx + 26 + modeBtnW / 2, modeY + 62);

    addTouchBtn('mode_quick', { x: cx + 26 + modeBtnW + modeGap, y: modeY, w: modeBtnW, h: modeBtnH });
    drawRoundedRect(ctx, cx + 26 + modeBtnW + modeGap, modeY, modeBtnW, modeBtnH, 16);
    if (settings.mode === 'quick') {
      ctx.fillStyle = 'rgba(143, 159, 136, 0.18)';
      ctx.fill();
      ctx.strokeStyle = '#8f9f88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(88, 84, 80, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#243038';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('快速模式', cx + 26 + modeBtnW + modeGap + modeBtnW / 2, modeY + 30);
    ctx.fillStyle = '#756c64';
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('达标过关', cx + 26 + modeBtnW + modeGap + modeBtnW / 2, modeY + 62);
    by += modeBtnH + 18;

    // Quick score select
    if (settings.mode === 'quick') {
      const qsCardX = cx + 26;
      const qsCardW = cardW - 52;
      const qsCardH = useCustomQuickScore ? 174 : 120;
      drawRoundedRect(ctx, qsCardX, by, qsCardW, qsCardH, 16);
      ctx.fillStyle = 'rgba(231, 225, 217, 0.45)';
      ctx.fill();

      ctx.fillStyle = '#756c64';
      ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('过关分数', qsCardX + 16, by + 22);

      const btnGap = 14;
      const qBtnW = (qsCardW - 32 - btnGap * 2) / 3;
      const qBtnH = 42;
      const qBtnY = by + 40;

      addTouchBtn('qscore_10', { x: qsCardX + 16, y: qBtnY, w: qBtnW, h: qBtnH });
      drawSegmentedOption('10分', qsCardX + 16, qBtnY, qBtnW, qBtnH,
        !useCustomQuickScore && settings.quickTargetScore === 10);

      addTouchBtn('qscore_25', { x: qsCardX + 16 + qBtnW + btnGap, y: qBtnY, w: qBtnW, h: qBtnH });
      drawSegmentedOption('25分', qsCardX + 16 + qBtnW + btnGap, qBtnY, qBtnW, qBtnH,
        !useCustomQuickScore && settings.quickTargetScore === 25);

      addTouchBtn('qscore_custom', { x: qsCardX + 16 + (qBtnW + btnGap) * 2, y: qBtnY, w: qBtnW, h: qBtnH });
      drawSegmentedOption('自定义', qsCardX + 16 + (qBtnW + btnGap) * 2, qBtnY, qBtnW, qBtnH, useCustomQuickScore);

      if (useCustomQuickScore) {
        const inputY = qBtnY + qBtnH + 14;
        const inputH = 42;
        addTouchBtn('qscore_input', { x: qsCardX + 16, y: inputY, w: qsCardW - 32, h: inputH });
        drawRoundedRect(ctx, qsCardX + 16, inputY, qsCardW - 32, inputH, 14);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(88, 84, 80, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#243038';
        ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${customQuickScore || settings.quickTargetScore} 分`, qsCardX + qsCardW / 2, inputY + inputH / 2);
      }

      by += qsCardH + 18;
    }
  });
  cy += firstCardH + cardGap;

  // Settings card
  drawSetupBlock(cx, cy, cardW, secondCardH, () => {
    let by = cy + 26;
    ctx.fillStyle = '#243038';
    ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('开局设置', cx + 26, by);
    by += 36;

    // Column select
    ctx.fillStyle = '#756c64';
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('区域大小', cx + 26, by);
    by += 26;

    const segGap = 14;
    const segW = (cardW - 52 - segGap * 2) / 3;
    const segH = 42;
    COLUMN_OPTIONS.forEach((cols, i) => {
      const sx = cx + 26 + (segW + segGap) * i;
      addTouchBtn(`cols_${cols}`, { x: sx, y: by, w: segW, h: segH });
      drawSegmentedOption(`${cols}列`, sx, by, segW, segH, settings.cols === cols);
    });
    by += segH + 32;

    // Speed select
    ctx.fillStyle = '#756c64';
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('速度等级', cx + 26, by);
    by += 26;

    SPEED_OPTIONS.forEach((speed, i) => {
      const sx = cx + 26 + (segW + segGap) * i;
      addTouchBtn(`speed_${speed}`, { x: sx, y: by, w: segW, h: segH });
      drawSegmentedOption(`${speed}倍`, sx, by, segW, segH, settings.speedMultiplier === speed);
    });
    by += segH + 20;

    // Start button
    by += 4;
    addTouchBtn('start_game', { x: cx + 26, y: by, w: cardW - 52, h: 48 });
    drawButtonGradient('开始游戏', cx + 26, by, cardW - 52, 48, 18,
      '#8f9f88', '#6f806a', '#faf7f2', 17);
  });
}

function drawSetupBlock(x, y, w, h, drawContent) {
  drawRoundedRect(ctx, x, y, w, h, CARD_RADIUS);
  ctx.fillStyle = 'rgba(248, 243, 235, 0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  drawContent();
  ctx.restore();
}

function drawGameScreen() {
  ctx.clearRect(0, 0, W, H);
  clearTouchButtons();

  // Background
  ctx.fillStyle = '#d7d0c6';
  ctx.fillRect(0, 0, W, H);

  // Top bar
  const safeB = sysInfo.safeArea ? Math.max(0, H - sysInfo.safeArea.bottom) : 0;
  const topOffset = sysInfo.statusBarHeight ? sysInfo.statusBarHeight + 48 : 112;
  const barY = topOffset;
  const layout = calcBoardLayout();
  const boardX = (W - layout.bw) / 2;
  const boardY = barY + TOP_BAR_H + GAP;

  // Score
  ctx.fillStyle = '#756c64';
  ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('得分', boardX, barY + 14);

  const scoreScale = scoreBump ? 1.12 : 1;
  ctx.save();
  ctx.translate(boardX, barY + 38);
  ctx.scale(scoreScale, scoreScale);
  ctx.fillStyle = '#243038';
  ctx.font = '700 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(snapshot.score), 0, 0);
  ctx.restore();

  // Timer (quick mode)
  if (snapshot.config.mode === 'quick' && snapshot.status !== 'idle') {
    const secs = Math.floor(snapshot.elapsedMs / 1000);
    const mins = Math.floor(secs / 60);
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    const tw = measureText(timeStr, 20);
    drawRoundedRect(ctx, (W - tw - 28) / 2, barY + 8, tw + 28, 36, 10);
    ctx.fillStyle = 'rgba(231, 225, 217, 0.5)';
    ctx.fill();
    ctx.fillStyle = '#243038';
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, W / 2, barY + 26);
  }

  // Settings button
  const setBtnX = boardX + layout.bw - 44;
  const setBtnY = barY + 4;
  addTouchBtn('settings_game', { x: setBtnX, y: setBtnY, w: 44, h: 44 });
  const setGrad = ctx.createLinearGradient(setBtnX, setBtnY, setBtnX + 44, setBtnY + 44);
  setGrad.addColorStop(0, '#8f9f88');
  setGrad.addColorStop(1, '#6f806a');
  drawRoundedRect(ctx, setBtnX, setBtnY, 44, 44, 22);
  ctx.fillStyle = setGrad;
  ctx.fill();
  ctx.fillStyle = '#faf7f2';
  ctx.font = '700 21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚙', setBtnX + 22, setBtnY + 22);

  // Board frame
  const bFrameR = 20;
  const bFramePad = 6;
  drawRoundedRect(ctx, boardX - bFramePad, boardY - bFramePad,
    layout.bw + bFramePad * 2, layout.bh + bFramePad * 2, bFrameR);
  ctx.fillStyle = 'rgba(249, 245, 238, 0.74)';
  ctx.fill();

  // Game board
  ctx.save();
  ctx.translate(boardX, boardY);

  if (renderer && canvasReady) {
    try {
      renderer.draw(snapshot);
    } catch (e) {
      renderer = null;
      canvasReady = false;
    }
  }

  if (!renderer || !canvasReady) {
    // Fallback: draw board background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, layout.bh);
    bgGrad.addColorStop(0, '#42545f');
    bgGrad.addColorStop(1, '#29343d');
    drawRoundedRect(ctx, 0, 0, layout.bw, layout.bh, 14);
    ctx.fillStyle = bgGrad;
    ctx.fill();
  }

  ctx.restore();

  // Game over / won overlay
  if (snapshot.status === 'won' || snapshot.status === 'gameOver') {
    const overlayX = boardX - bFramePad;
    const overlayY = boardY - bFramePad;
    const overlayW = layout.bw + bFramePad * 2;
    const overlayH = layout.bh + bFramePad * 2;

    drawRoundedRect(ctx, overlayX, overlayY, overlayW, overlayH, bFrameR);
    ctx.fillStyle = 'rgba(29, 38, 44, 0.5)';
    ctx.fill();

    const popW = Math.min(360, Math.max(260, overlayW - 72));
    const popH = 178;
    const popX = overlayX + (overlayW - popW) / 2;
    const popY = overlayY + Math.max(82, Math.floor((overlayH - popH) * 0.42));
    drawRoundedRect(ctx, popX, popY, popW, popH, 24);
    ctx.fillStyle = 'rgba(248, 243, 235, 0.96)';
    ctx.fill();

    const title = snapshot.status === 'won' ? '挑战成功' : '游戏结束';
    ctx.fillStyle = '#243038';
    ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, popX + popW / 2, popY + 38);

    if (snapshot.status === 'won') {
      const secs = Math.floor(snapshot.elapsedMs / 1000);
      const mins = Math.floor(secs / 60);
      ctx.fillStyle = '#756c64';
      ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(`用时 ${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
        popX + popW / 2, popY + 68);
    } else {
      ctx.fillStyle = '#756c64';
      ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText('方块已经堆到顶部', popX + popW / 2, popY + 68);
    }

    const actionX = popX + 22;
    const actionW = popW - 44;
    const restartY = popY + 88;
    const exitY = restartY + 50;
    addTouchBtn('restart', { x: actionX, y: restartY, w: actionW, h: 44 });
    drawButtonSolid('重新开始', actionX, restartY, actionW, 44, 22,
      '#8f9f88', '#faf7f2', 18);

    addTouchBtn('exit_game', { x: actionX, y: exitY, w: actionW, h: 40 });
    drawRoundedRect(ctx, actionX, exitY, actionW, 40, 20);
    ctx.fillStyle = 'rgba(250, 248, 244, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(143, 159, 136, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#4e4944';
    ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('退出游戏', popX + popW / 2, exitY + 20);
  }

  // Touch layer for game controls
  if (snapshot.status === 'running') {
    addTouchBtn('game_touch', { x: boardX - bFramePad, y: boardY - bFramePad,
      w: layout.bw + bFramePad * 2, h: layout.bh + bFramePad * 2 });
  }
}

function drawSettingsScreen() {
  ctx.clearRect(0, 0, W, H);
  clearTouchButtons();
  addTouchBtn('settings_backdrop', { x: 0, y: 0, w: W, h: H });

  // Backdrop
  ctx.fillStyle = 'rgba(34, 44, 51, 0.3)';
  ctx.fillRect(0, 0, W, H);

  // Panel
  const panelW = Math.min(360, W - 48);
  const panelH = Math.min(H - 96, 480);
  const panelX = (W - panelW) / 2;
  const panelY = (H - panelH) / 2;
  addTouchBtn('settings_panel', { x: panelX, y: panelY, w: panelW, h: panelH });

  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.fillStyle = 'rgba(248, 243, 235, 0.98)';
  ctx.fill();

  let tabStartY;
  if (settingsFromGame) {
    // Action buttons
    addTouchBtn('restart_home', { x: panelX + 20, y: panelY + 20, w: (panelW - 52) / 2, h: 48 });
    drawRoundedRect(ctx, panelX + 20, panelY + 20, (panelW - 52) / 2, 48, 16);
    ctx.fillStyle = 'rgba(250, 248, 244, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(143, 159, 136, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#4e4944';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('重新开始', panelX + 20 + (panelW - 52) / 4, panelY + 44);

    addTouchBtn('continue', { x: panelX + 20 + (panelW - 52) / 2 + 12, y: panelY + 20,
      w: (panelW - 52) / 2, h: 48 });
    drawRoundedRect(ctx, panelX + 20 + (panelW - 52) / 2 + 12, panelY + 20,
      (panelW - 52) / 2, 48, 16);
    const cGrad = ctx.createLinearGradient(
      panelX + 20 + (panelW - 52) / 2 + 12, panelY + 20,
      panelX + 20 + (panelW - 52) / 2 + 12 + (panelW - 52) / 2, panelY + 68);
    cGrad.addColorStop(0, '#8f9f88');
    cGrad.addColorStop(1, '#6f806a');
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.fillStyle = '#faf7f2';
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('继续游戏', panelX + 20 + (panelW - 52) / 2 + 12 + (panelW - 52) / 4, panelY + 44);

    tabStartY = panelY + 84;
  } else {
    tabStartY = panelY + 24;
  }

  // Tabs
  const tabW = panelW - 40;
  const tabH = 38;
  const tabsX = panelX + 20;
  drawRoundedRect(ctx, tabsX, tabStartY, tabW, tabH, SETTINGS_TAB_RADIUS);
  ctx.fillStyle = 'rgba(231, 225, 217, 0.5)';
  ctx.fill();

  const tabBtnW = tabW / 2;
  addTouchBtn('tab_rules', { x: tabsX, y: tabStartY, w: tabBtnW, h: tabH });
  addTouchBtn('tab_controls', { x: tabsX + tabBtnW, y: tabStartY, w: tabBtnW, h: tabH });

  if (settingsTab === 'rules') {
    drawRoundedRect(ctx, tabsX, tabStartY, tabBtnW, tabH, SETTINGS_TAB_RADIUS);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
  } else {
    drawRoundedRect(ctx, tabsX + tabBtnW, tabStartY, tabBtnW, tabH, SETTINGS_TAB_RADIUS);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
  }

  ctx.fillStyle = settingsTab === 'rules' ? '#243038' : '#756c64';
  ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('规则', tabsX + tabBtnW / 2, tabStartY + tabH / 2);
  ctx.fillStyle = settingsTab === 'controls' ? '#243038' : '#756c64';
  ctx.fillText('指引', tabsX + tabBtnW + tabBtnW / 2, tabStartY + tabH / 2);

  // Tab content
  const contentY = tabStartY + tabH + 16;
  if (settingsTab === 'rules') {
    const lines = [
      '所有下落方块都是 1x1 单格。',
      '落地后，盘里所有方块都会继续检查下方是否可下落或融合。',
      '当正下方方块颜色一致时，会自动融合并加深一个层级。',
      '一整行全部填满且颜色一致时，会被清除并计分。',
    ];
    let textY = contentY + 20;
    lines.forEach((line) => {
      if (textY + 20 > panelY + panelH - 16) return;
      ctx.fillStyle = '#4e4944';
      ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      textY = wrapText(ctx, line, panelX + 24, textY, panelW - 48, 20) + 26;
    });
    drawRuleDiagram(panelX + 24, textY - 8, panelW - 48, panelY + panelH - 22);
  } else {
    const lines = ['左滑：当前方块向左移动一列。', '右滑：当前方块向右移动一列。', '下滑：加速下落。'];
    lines.forEach((line, i) => {
      ctx.fillStyle = '#4e4944';
      ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(line, panelX + 24, contentY + i * 44 + 22);
    });
  }
}

function drawRuleDiagram(x, y, w, maxBottom) {
  const h = Math.min(150, Math.max(0, maxBottom - y));
  if (h < 112) return;

  drawRoundedRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = 'rgba(231, 225, 217, 0.5)';
  ctx.fill();

  const innerX = x + 18;
  const labelW = 44;
  const block = Math.min(26, Math.floor((w - 112) / 7));
  const gap = 6;
  const flowX = innerX + labelW + 12;
  const resultX = x + w - 18 - block * 2 - gap;
  const arrowStartX = flowX + block * 2 + gap + 16;
  const arrowEndX = Math.max(arrowStartX + 26, resultX - 16);
  const mergeY = y + 36;
  const clearY = y + h - 56;
  const colorA = theme.blocks[1] || '#c8daa0';
  const colorB = theme.blocks[2] || '#8db84e';

  ctx.fillStyle = '#756c64';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('融合', innerX, mergeY);
  ctx.fillText('消除', innerX, clearY + block / 2);

  drawMiniBlock(flowX, mergeY - block - 5, block, colorA);
  drawMiniBlock(flowX, mergeY + 5, block, colorA);
  drawArrow(arrowStartX, mergeY + block / 2, arrowEndX, mergeY + block / 2);
  drawMiniBlock(resultX + Math.floor(block / 2), mergeY - block / 2 + 2, block, colorB);

  const rowX = flowX;
  for (let i = 0; i < 4; i += 1) {
    drawMiniBlock(rowX + i * (block + gap), clearY, block, colorA);
  }
  drawArrow(rowX + 4 * (block + gap) + 14, clearY + block / 2, arrowEndX, clearY + block / 2);
  drawDashedClearRow(resultX, clearY, block, colorA);
}

function drawMiniBlock(x, y, size, color) {
  drawRoundedRect(ctx, x, y, size, size, 4);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.fillRect(x + 3, y + 3, size - 6, Math.max(3, size * 0.18));
}

function drawDashedClearRow(x, y, size, color) {
  ctx.save();
  ctx.globalAlpha = 0.36;
  for (let i = 0; i < 2; i += 1) {
    drawMiniBlock(x + i * (size + 5), y, size, color);
  }
  ctx.globalAlpha = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#8f9f88';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x - 2, y - 2, size * 2 + 9, size + 4, 5);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(x1, y1, x2, y2) {
  ctx.strokeStyle = '#8f9f88';
  ctx.fillStyle = '#8f9f88';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7, y2 - 4);
  ctx.lineTo(x2 - 7, y2 + 4);
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = text.split('');
  let line = '';
  for (const ch of chars) {
    const testLine = line + ch;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = ch;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
  }
  return y;
}

// ====== Main Render ======
function render() {
  if (currentScreen === 'home') drawHomeScreen();
  else if (currentScreen === 'setup') drawSetupScreen();
  else if (currentScreen === 'game') drawGameScreen();
  else if (currentScreen === 'settings') drawSettingsScreen();
}

// ====== Game Canvas Setup ======
function setupGameCanvas() {
  const layout = calcBoardLayout();

  renderer = createCanvasRenderer(theme);
  renderer.resize({
    context: ctx,
    width: layout.bw,
    height: layout.bh,
    ratio: 1,
    rows: snapshot.config.rows,
    cols: snapshot.config.cols,
  });
  canvasReady = true;
}

// ====== Game Loop ======
function requestFrame(callback) {
  return setTimeout(() => callback(now()), 16);
}

function cancelFrame(handle) {
  if (handle) clearTimeout(handle);
}

function refresh() {
  const nextSnapshot = game.getSnapshot();
  snapshot = nextSnapshot;
  return nextSnapshot;
}

function loop(timestamp) {
  try {
    game.tick(timestamp || now());
    refresh();
    render();
    if (snapshot.status === 'running') {
      animationHandle = requestFrame(loop);
    } else {
      animationHandle = null;
      if (snapshot.status === 'won' || snapshot.status === 'gameOver') {
        render();
      }
    }
  } catch (err) {
    console.error('[loop]', err);
    animationHandle = requestFrame(loop);
  }
}

function startLoop() {
  stopLoop();
  loop(now());
}

function stopLoop() {
  cancelFrame(animationHandle);
  animationHandle = null;
}

// ====== Touch handler ======
let touchStartPoint = null;
let gameTouchHandler = null;

function handleTouchStart(e) {
  const touch = e.changedTouches?.[0] || e.touches?.[0] || e;
  const tx = touch.clientX ?? touch.x ?? 0;
  const ty = touch.clientY ?? touch.y ?? 0;

  if (currentScreen === 'game') {
    // Check if touching overlay buttons
    if (snapshot.status === 'won' || snapshot.status === 'gameOver') {
      const btn = hitTest(tx, ty);
      if (btn === 'restart') {
        handleRestart();
        return;
      }
      if (btn === 'exit_game') {
        handleExit();
        return;
      }
      return;
    }

    // Check settings button
    const btn = hitTest(tx, ty);
    if (btn === 'settings_game') {
      handleOpenSettings();
      return;
    }

    // Game touch controls
    if (snapshot.status === 'running') {
      touchStartPoint = { x: tx, y: ty };
    }
    return;
  }

  if (currentScreen === 'home') {
    const btn = hitTest(tx, ty);
    if (btn === 'start') {
      goToSetup();
    } else if (btn === 'settings_controls') {
      currentScreen = 'settings';
      settingsTab = 'controls';
      settingsFromGame = false;
      render();
    }
    return;
  }

  if (currentScreen === 'setup') {
    handleSetupTouch(tx, ty);
    return;
  }

  if (currentScreen === 'settings') {
    handleSettingsTouch(tx, ty);
    return;
  }
}

function handleTouchMove(e) {
  if (currentScreen !== 'game' || !touchStartPoint) return;
  // No-op for game, we only care about end point
}

function handleTouchEnd(e) {
  if (currentScreen === 'game' && touchStartPoint) {
    const touch = e.changedTouches?.[0] || e.touches?.[0] || e;
    const tx = touch.clientX ?? touch.x ?? 0;
    const ty = touch.clientY ?? touch.y ?? 0;
    const dx = tx - touchStartPoint.x;
    const dy = ty - touchStartPoint.y;
    const threshold = 24;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) game.moveLeft();
      else game.moveRight();
    } else if (dy > threshold && Math.abs(dy) >= Math.abs(dx)) {
      game.softDropStart();
    }

    touchStartPoint = null;
    refresh();
  }
}

// ====== Screen transitions ======
function handleSetupTouch(tx, ty) {
  const btn = hitTest(tx, ty);
  if (!btn) return;

  if (btn === 'mode_endless') {
    settings.mode = 'endless';
    render();
    return;
  }
  if (btn === 'mode_quick') {
    settings.mode = 'quick';
    render();
    return;
  }
  if (btn === 'qscore_10') {
    useCustomQuickScore = false;
    settings.quickTargetScore = 10;
    render();
    return;
  }
  if (btn === 'qscore_25') {
    useCustomQuickScore = false;
    settings.quickTargetScore = 25;
    render();
    return;
  }
  if (btn === 'qscore_custom') {
    useCustomQuickScore = true;
    settings.quickTargetScore = parseInt(customQuickScore, 10) || 30;
    render();
    return;
  }
  if (btn === 'qscore_input') {
    openCustomScoreInput();
    return;
  }
  if (btn.startsWith('cols_')) {
    const cols = parseInt(btn.split('_')[1]);
    settings.cols = cols;
    render();
    return;
  }
  if (btn.startsWith('speed_')) {
    const speed = parseInt(btn.split('_')[1]);
    settings.speedMultiplier = speed;
    render();
    return;
  }
  if (btn === 'start_game') {
    startNewGame();
    return;
  }
}

function openCustomScoreInput() {
  if (!wx.showKeyboard || customScoreInputActive) {
    return;
  }

  customScoreInputActive = true;
  wx.showKeyboard({
    defaultValue: customQuickScore,
    maxLength: 3,
    multiple: false,
    confirmType: 'done',
    fail() {
      customScoreInputActive = false;
    },
  });

  const syncValue = (res = {}) => {
    const digits = String(res.value || '').replace(/\D/g, '').slice(0, 3);
    customQuickScore = digits;
    const score = Math.max(1, parseInt(digits, 10) || 30);
    settings.quickTargetScore = score;
    render();
  };

  const closeInput = (res = {}) => {
    syncValue(res);
    if (wx.offKeyboardInput) wx.offKeyboardInput(syncValue);
    if (wx.offKeyboardConfirm) wx.offKeyboardConfirm(closeInput);
    if (wx.offKeyboardComplete) wx.offKeyboardComplete(closeInput);
    if (wx.hideKeyboard) wx.hideKeyboard();
    customScoreInputActive = false;
  };

  if (wx.onKeyboardInput) wx.onKeyboardInput(syncValue);
  if (wx.onKeyboardConfirm) wx.onKeyboardConfirm(closeInput);
  if (wx.onKeyboardComplete) wx.onKeyboardComplete(closeInput);
}

function handleSettingsTouch(tx, ty) {
  const btn = hitTest(tx, ty);
  if (!btn) return;

  if (btn === 'settings_backdrop') {
    if (settingsFromGame) {
      continueGame();
    } else {
      currentScreen = 'home';
      render();
    }
    return;
  }

  if (btn === 'settings_panel') {
    return;
  }

  if (btn === 'tab_rules') {
    settingsTab = 'rules';
    render();
    return;
  }
  if (btn === 'tab_controls') {
    settingsTab = 'controls';
    render();
    return;
  }
  if (btn === 'continue') {
    continueGame();
    return;
  }
  if (btn === 'restart_home') {
    currentScreen = 'setup';
    settingsFromGame = false;
    stopLoop();
    game.exit();
    render();
    return;
  }
}

function goToSetup() {
  currentScreen = 'setup';
  render();
}

function startNewGame() {
  currentScreen = 'game';
  stopLoop();
  game.start({ ...settings });
  snapshot = game.getSnapshot();
  setupGameCanvas();
  render();
  startLoop();
}

function handleOpenSettings() {
  currentScreen = 'settings';
  settingsTab = 'rules';
  settingsFromGame = true;
  if (snapshot.status === 'running') {
    game.pause('manual');
    refresh();
    stopLoop();
  }
  render();
}

function continueGame() {
  currentScreen = 'game';
  settingsFromGame = false;
  refresh();
  if (snapshot.status === 'paused') {
    game.resume('manual');
    refresh();
    startLoop();
    return;
  }
  render();
}

function handleRestart() {
  stopLoop();
  game.exit();
  currentScreen = 'setup';
  render();
}

function handleExit() {
  stopLoop();
  game.exit();
  renderer?.destroy();
  renderer = null;
  canvasReady = false;
  currentScreen = 'home';
  render();
}

function handleRestartToHome() {
  stopLoop();
  game.exit();
  renderer?.destroy();
  renderer = null;
  canvasReady = false;
  currentScreen = 'home';
  render();
}

// ====== Lifecycle ======
wx.onShow(() => {
  lifecycle.handleShow();
  if (currentScreen === 'game' && snapshot.status === 'running' && !animationHandle) {
    startLoop();
  }
  render();
});

wx.onHide(() => {
  lifecycle.handleHide();
  stopLoop();
});

// ====== Touch events ======
wx.onTouchStart((e) => handleTouchStart(e));
wx.onTouchMove((e) => handleTouchMove(e));
wx.onTouchEnd((e) => handleTouchEnd(e));

// ====== Initial render ======
render();
