<template>
  <view class="page-shell">
    <view class="app-frame" :style="appFrameStyle">
      <view class="top-bar">
        <view class="score-group">
          <text class="score-label">得分</text>
          <text :class="['score-value', scoreBump && 'bump']">{{ snapshot.score }}</text>
        </view>
        <view v-if="snapshot.config.mode === 'quick' && screen === 'game'" class="timer-display">
          <text class="timer-text">{{ formattedTime }}</text>
        </view>
        <view class="status-indicator">
          <text class="status-text">{{ statusText }}</text>
        </view>
        <button class="settings-btn" @tap="openSettings('rules')">⚙</button>
      </view>

      <view class="game-area">
        <view
          :class="['canvas-wrapper', screen === 'game' && 'is-playing']"
          :style="gameBoardStyle"
        >
          <canvas
            v-if="screen === 'game' && !settingsVisible"
            id="gameCanvas"
            canvas-id="gameCanvas"
            type="2d"
            class="game-canvas"
            disable-scroll="true"
          />
          <view v-if="screen === 'game' && (!canvasReady || settingsVisible)" class="dom-board">
            <view v-if="nextPreviewVisible" :class="['next-preview-rail', nextPreviewPulse && 'is-changing']" :style="nextPreviewStyle" />
            <view
              v-for="cell in domBoardCells"
              :key="cell.key"
              class="dom-block settled"
              :style="cell.style"
            />
            <view v-if="activeBlockStyle" class="dom-block active" :style="activeBlockStyle" />
          </view>
          <view
            v-if="screen === 'game' && !overlayVisible"
            class="game-touch-layer"
            @touchstart.stop.prevent="touch.touchStart"
            @touchmove.stop.prevent="touch.touchMove"
            @touchend.stop.prevent="touch.touchEnd"
            @touchcancel.stop.prevent="touch.cancel"
          />

          <view v-if="screen !== 'game'" class="canvas-placeholder" />

          <view v-if="overlayVisible" class="game-overlay">
            <view class="overlay-content">
              <text class="overlay-title">{{ overlayTitle }}</text>
              <text v-if="overlayText" class="overlay-subtitle">{{ overlayText }}</text>
              <button class="overlay-primary" @tap="restartFromSetup">重新开始</button>
              <button class="overlay-secondary" @tap="exitGame">退出游戏</button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="screen === 'home'" class="start-page">
      <view class="start-content">
        <text class="start-title">彩块叠叠</text>
        <text class="start-subtitle">轻松休闲的融合消除游戏</text>
        <button class="start-btn" @tap.stop="goSetup">开始模式</button>
        <button class="start-guide-btn" @tap.stop="openSettings('controls')">指引</button>
      </view>
    </view>

    <view v-if="screen === 'setup'" class="mode-select">
      <view class="mode-select-backdrop" @tap="goHome" />
      <scroll-view class="mode-select-content" :style="modeSelectContentStyle" scroll-y @tap.stop>
        <view class="setup-block">
          <text class="setup-title">选择模式</text>
          <view class="mode-grid">
            <button :class="['mode-btn', settings.mode === 'endless' && 'selected']" @tap.stop="settings.mode = 'endless'">
              <text class="mode-btn-title">无限模式</text>
              <text class="mode-btn-desc">自由畅玩</text>
            </button>
            <button :class="['mode-btn', settings.mode === 'quick' && 'selected']" @tap.stop="settings.mode = 'quick'">
              <text class="mode-btn-title">快速模式</text>
              <text class="mode-btn-desc">达标过关</text>
            </button>
          </view>

          <view v-if="settings.mode === 'quick'" class="quick-score-select">
            <text class="quick-score-label">过关分数</text>
            <button :class="['quick-score-btn', !useCustomQuickScore && settings.quickTargetScore === 10 && 'selected']" @tap.stop="selectQuickScore(10)">10分</button>
            <button :class="['quick-score-btn', !useCustomQuickScore && settings.quickTargetScore === 25 && 'selected']" @tap.stop="selectQuickScore(25)">25分</button>
            <button :class="['quick-score-btn', useCustomQuickScore && 'selected']" @tap.stop="useCustomQuickScore = true">自定义</button>
            <view class="quick-custom-score">
              <input class="quick-custom-input" type="number" v-model="customQuickScore" @focus="useCustomQuickScore = true" />
              <text class="quick-custom-unit">分</text>
            </view>
          </view>
        </view>

        <view class="setup-block">
          <text class="setup-title">开局设置</text>
          <view class="setup-field">
            <text class="setup-label">区域大小</text>
            <view class="segmented-options">
              <button v-for="cols in columnOptions" :key="cols" :class="['setup-option', settings.cols === cols && 'selected']" @tap.stop="settings.cols = cols">{{ cols }}列</button>
            </view>
          </view>
          <view class="setup-field">
            <text class="setup-label">速度等级</text>
            <view class="segmented-options">
              <button v-for="speed in speedOptions" :key="speed" :class="['setup-option', settings.speedMultiplier === speed && 'selected']" @tap.stop="settings.speedMultiplier = speed">{{ speed }}倍</button>
            </view>
          </view>
          <button class="setup-start-btn" @tap.stop="startGame">开始游戏</button>
        </view>
      </scroll-view>
    </view>

    <view v-if="settingsVisible" class="settings-panel">
      <view class="settings-backdrop" @tap="continueCurrentGame" />
      <view class="settings-window">
        <view class="settings-actions">
          <button class="settings-action restart-action" @tap="restartToHome">重新开始</button>
          <button class="settings-action continue-action" @tap="continueCurrentGame">继续游戏</button>
        </view>
        <view class="settings-header">
          <button :class="['tab-btn', settingsTab === 'rules' && 'active']" @tap="settingsTab = 'rules'">规则</button>
          <button :class="['tab-btn', settingsTab === 'controls' && 'active']" @tap="settingsTab = 'controls'">指引</button>
        </view>
        <view v-if="settingsTab === 'rules'" class="tab-content">
          <text class="tab-line">所有下落方块都是 1x1 单格。</text>
          <text class="tab-line">落地后，盘里所有方块都会继续检查下方是否可下落或融合。</text>
          <text class="tab-line">当正下方方块颜色一致时，会自动融合并加深一个层级。</text>
          <text class="tab-line">一整行全部填满且颜色一致时，会被清除并计分。</text>
        </view>
        <view v-else class="tab-content">
          <text class="tab-line">左滑：当前方块向左移动一列。</text>
          <text class="tab-line">右滑：当前方块向右移动一列。</text>
          <text class="tab-line">下滑：加速下落。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import { onHide, onReady, onShow, onUnload } from "@dcloudio/uni-app";
import { createGame } from "../../core/game.js";
import { createCanvasRenderer } from "../../renderers/canvas-renderer.js";
import { createTouchInput } from "../../platforms/wechat/touch-input.js";
import { createGameLifecycle } from "../../platforms/wechat/lifecycle.js";
import { COLUMN_OPTIONS, DEFAULT_GAME_OPTIONS, SPEED_OPTIONS } from "../../shared/constants.js";
import { pickTheme } from "../../shared/themes.js";

const columnOptions = COLUMN_OPTIONS;
const speedOptions = SPEED_OPTIONS;
const screen = ref("home");
const settingsVisible = ref(false);
const settingsTab = ref("rules");
const useCustomQuickScore = ref(false);
const customQuickScore = ref("30");
const settings = reactive({ ...DEFAULT_GAME_OPTIONS });
const game = createGame();
const lifecycle = createGameLifecycle(game);
const snapshot = ref(game.getSnapshot());
const scoreBump = ref(false);
const navigationTopOffset = ref(112);
const canvasReady = ref(false);
const nextPreviewPulse = ref(false);
const componentInstance = getCurrentInstance();
const HTML_BLOCK_SIZE = 52;
const HTML_ROWS = 11;
const theme = pickTheme();
let renderer = null;
let animationHandle = null;

const touch = createTouchInput({
  onLeft: () => {
    if (snapshot.value.status === "running") {
      game.moveLeft();
      refresh();
    }
  },
  onRight: () => {
    if (snapshot.value.status === "running") {
      game.moveRight();
      refresh();
    }
  },
  onDown: () => {
    if (snapshot.value.status !== "running") {
      return;
    }
    game.softDropStart();
    refresh();
  },
});

const formattedTime = computed(() => {
  const seconds = Math.floor(snapshot.value.elapsedMs / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
});

const statusText = computed(() => {
  const status = snapshot.value.status;
  if (status === "running") return "进行中";
  if (status === "paused") return "已暂停";
  if (status === "won") return "挑战成功";
  if (status === "gameOver") return "已结束";
  return "就绪";
});

const overlayVisible = computed(() => screen.value === "game" && ["won", "gameOver"].includes(snapshot.value.status));
const overlayTitle = computed(() => {
  if (snapshot.value.status === "won") return "挑战成功";
  if (snapshot.value.status === "gameOver") return "游戏结束";
  return "暂停";
});
const overlayText = computed(() => {
  if (snapshot.value.status === "won") return `用时 ${formattedTime.value}`;
  if (snapshot.value.status === "gameOver") return "方块已经堆到顶部";
  return "";
});

const gameBoardStyle = computed(() => {
  const cols = screen.value === "game" ? snapshot.value.config.cols : settings.cols;
  const width = cols * HTML_BLOCK_SIZE;
  const height = HTML_ROWS * HTML_BLOCK_SIZE;
  return {
    width: `${width}px`,
    aspectRatio: `${width} / ${height}`,
  };
});

const appFrameStyle = computed(() => ({
  paddingTop: `${navigationTopOffset.value}px`,
}));

const modeSelectContentStyle = computed(() => ({
  paddingTop: `${navigationTopOffset.value + 16}px`,
}));

const cellWidthPercent = computed(() => 100 / snapshot.value.config.cols);
const cellHeightPercent = computed(() => 100 / snapshot.value.config.rows);

function blockColor(level) {
  return theme.blocks[level] || theme.blocks[theme.blocks.length - 1];
}

function domBlockStyle(x, y, level) {
  const inset = 1.6;
  return {
    left: `${x * cellWidthPercent.value}%`,
    top: `${y * cellHeightPercent.value}%`,
    width: `${cellWidthPercent.value}%`,
    height: `${cellHeightPercent.value}%`,
    padding: `${inset}px`,
    backgroundColor: blockColor(level),
  };
}

const domBoardCells = computed(() => {
  const cells = [];
  snapshot.value.board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell) {
        cells.push({
          key: `${x}-${y}-${cell.level}`,
          style: domBlockStyle(x, y, cell.level),
        });
      }
    });
  });
  return cells;
});

const activeBlockStyle = computed(() => {
  const piece = snapshot.value.currentPiece;
  if (!piece) {
    return null;
  }
  return domBlockStyle(piece.x, piece.y + piece.fallProgress, piece.level);
});

const nextPreviewStyle = computed(() => {
  const next = snapshot.value.nextPiece;
  return {
    backgroundColor: blockColor(next?.level || 0),
  };
});

const nextPreviewVisible = computed(() => {
  const piece = snapshot.value.currentPiece;
  if (!piece) {
    return Boolean(snapshot.value.nextPiece);
  }
  return piece.y + piece.fallProgress > 0.27;
});

watch(
  () => snapshot.value.score,
  (nextScore, previousScore) => {
    if (nextScore <= previousScore) {
      return;
    }
    scoreBump.value = false;
    setTimeout(() => {
      scoreBump.value = true;
      setTimeout(() => {
        scoreBump.value = false;
      }, 130);
    }, 0);
  },
);

watch(
  () => {
    const spawnEvent = [...(snapshot.value.events || [])].reverse().find((event) => event.type === "spawn");
    return spawnEvent ? `${spawnEvent.at}-${spawnEvent.piece?.x}-${spawnEvent.piece?.level}-${spawnEvent.nextLevel}` : "";
  },
  (nextSpawnKey, previousSpawnKey) => {
    if (!nextSpawnKey || nextSpawnKey === previousSpawnKey) {
      return;
    }
    nextPreviewPulse.value = false;
    setTimeout(() => {
      nextPreviewPulse.value = true;
      setTimeout(() => {
        nextPreviewPulse.value = false;
      }, 420);
    }, 0);
  },
);

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function requestFrame(callback) {
  if (typeof requestAnimationFrame !== "undefined") {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(now()), 16);
}

function cancelFrame(handle) {
  if (!handle) return;
  if (typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}

function updateNavigationOffset() {
  try {
    const menuRect = uni.getMenuButtonBoundingClientRect?.();
    const systemInfo = uni.getSystemInfoSync?.();
    const statusBarHeight = systemInfo?.statusBarHeight || 44;
    const menuBottom = menuRect?.bottom || statusBarHeight + 48;
    navigationTopOffset.value = Math.ceil(menuBottom + 16);
  } catch (error) {
    navigationTopOffset.value = 112;
  }
}

function goHome() {
  screen.value = "home";
}

function goSetup() {
  settingsVisible.value = false;
  screen.value = "setup";
}

function openSettings(tab) {
  settingsTab.value = tab;
  settingsVisible.value = true;
  if (screen.value === "game" && snapshot.value.status === "running") {
    game.pause("manual");
    refresh();
    stopLoop();
  }
  if (screen.value === "game") {
    renderer?.destroy();
    renderer = null;
    canvasReady.value = false;
  }
}

function selectQuickScore(score) {
  useCustomQuickScore.value = false;
  settings.quickTargetScore = score;
}

function applyQuickScore() {
  if (settings.mode !== "quick") {
    settings.quickTargetScore = 25;
    return true;
  }
  if (!useCustomQuickScore.value) {
    return true;
  }
  const parsed = Number(customQuickScore.value);
  if (!Number.isFinite(parsed) || parsed <= 25) {
    uni.showToast?.({ title: "自定义分数需大于25", icon: "none" });
    return false;
  }
  settings.quickTargetScore = Math.floor(parsed);
  return true;
}

function refresh() {
  snapshot.value = game.getSnapshot();
  if (renderer && canvasReady.value) {
    try {
      renderer.draw(snapshot.value);
    } catch (error) {
      renderer?.destroy();
      renderer = null;
      canvasReady.value = false;
    }
  }
}

function loop(timestamp) {
  game.tick(timestamp || now());
  refresh();
  if (snapshot.value.status === "running") {
    animationHandle = requestFrame(loop);
  } else {
    animationHandle = null;
  }
}

function stopLoop() {
  cancelFrame(animationHandle);
  animationHandle = null;
}

function startLoop() {
  stopLoop();
  animationHandle = requestFrame(loop);
}

function queryCanvasNode() {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 300);

    try {
      const query = uni.createSelectorQuery();
      if (componentInstance?.proxy && query.in) {
        query.in(componentInstance.proxy);
      }
      query
        .select("#gameCanvas")
        .fields({ node: true, size: true })
        .exec((result) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(result?.[0]?.node ? result[0] : null);
        });
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

async function initCanvas() {
  const systemInfo = uni.getSystemInfoSync?.() || {};
  const maxBoardWidth = Math.max(260, (systemInfo.windowWidth || 390) - 64);
  const fallbackWidth = Math.floor(Math.min(snapshot.value.config.cols * HTML_BLOCK_SIZE, maxBoardWidth));
  const fallbackHeight = Math.floor(fallbackWidth * HTML_ROWS / snapshot.value.config.cols);
  const pixelRatio = systemInfo.pixelRatio || 1;
  const canvasInfo = await queryCanvasNode();
  const canvasNode = canvasInfo?.node;

  if (!canvasNode?.getContext) {
    canvasReady.value = false;
    return;
  }

  const width = Math.floor(canvasInfo.width || fallbackWidth);
  const height = Math.floor(canvasInfo.height || fallbackHeight);
  const context = canvasNode.getContext("2d");

  renderer?.destroy();
  renderer = createCanvasRenderer(theme);
  renderer.resize({
    context,
    canvasNode,
    width,
    height,
    ratio: pixelRatio,
    rows: snapshot.value.config.rows,
    cols: snapshot.value.config.cols,
  });
  canvasReady.value = true;
  refresh();
}

async function startGame() {
  if (!applyQuickScore()) {
    return;
  }
  screen.value = "game";
  game.start({ ...settings });
  refresh();
  await nextTick();
  try {
    await initCanvas();
  } catch (error) {
    canvasReady.value = false;
  }
  startLoop();
}

function resumeGame() {
  game.resume("manual");
  refresh();
}

async function continueCurrentGame() {
  settingsVisible.value = false;
  if (screen.value === "game" && snapshot.value.status === "paused") {
    await nextTick();
    try {
      await initCanvas();
    } catch (error) {
      canvasReady.value = false;
    }
    resumeGame();
    startLoop();
  }
}

function restartToHome() {
  settingsVisible.value = false;
  stopLoop();
  game.exit();
  refresh();
  canvasReady.value = false;
  screen.value = "home";
}

function restartFromSetup() {
  stopLoop();
  game.exit();
  refresh();
  canvasReady.value = false;
  screen.value = "setup";
}

function exitGame() {
  stopLoop();
  game.exit();
  refresh();
  canvasReady.value = false;
  screen.value = "home";
}

onReady(() => {
  updateNavigationOffset();
  refresh();
});

onShow(() => {
  updateNavigationOffset();
  lifecycle.handleShow();
  refresh();
  if (screen.value === "game" && snapshot.value.status === "running" && !animationHandle) {
    startLoop();
  }
});

onHide(() => {
  lifecycle.handleHide();
  refresh();
  stopLoop();
});

onUnload(() => {
  stopLoop();
  renderer?.destroy();
});

onBeforeUnmount(() => {
  stopLoop();
  renderer?.destroy();
});
</script>

<style scoped>
.page-shell {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #d7d0c6;
  color: #4e4944;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-frame {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 393px;
  height: 100%;
  min-height: 0;
  max-width: 100vw;
  overflow: hidden;
  box-sizing: border-box;
  padding: 112px 8px env(safe-area-inset-bottom, 0px);
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 0 6px 8px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.score-group {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 104px;
}

.score-label,
.status-text {
  font-size: 13px;
  color: #756c64;
}

.score-value {
  font-size: 34px;
  font-weight: 700;
  color: #243038;
  line-height: 1;
  transition: transform 0.12s ease;
}

.score-value.bump {
  transform: scale(1.12);
}

.timer-display {
  flex: 1;
  display: flex;
  justify-content: center;
}

.timer-text {
  padding: 4px 14px;
  border-radius: 10px;
  background: rgba(231, 225, 217, 0.5);
  color: #243038;
  font-size: 20px;
  font-weight: 600;
}

.status-indicator {
  display: flex;
  justify-content: flex-end;
  min-width: 54px;
}

.settings-btn {
  width: 44px;
  height: 44px;
  margin-left: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8f9f88, #6f806a);
  color: #faf7f2;
  font-size: 21px;
  font-weight: 700;
  transition: transform 0.16s ease, filter 0.16s ease;
}

.settings-btn:active {
  transform: scale(0.92);
}

.game-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 4px 0 8px;
  box-sizing: border-box;
  touch-action: none;
  user-select: none;
}

.canvas-wrapper {
  position: relative;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  border: 6px solid rgba(249, 245, 238, 0.74);
  border-radius: 20px;
  overflow: hidden;
  box-sizing: border-box;
  background: linear-gradient(180deg, #36434c, #263039);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42), 0 12px 32px rgba(53, 64, 72, 0.2);
  transition: transform 0.24s ease, box-shadow 0.24s ease;
}

.canvas-wrapper.is-playing {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42), 0 14px 34px rgba(53, 64, 72, 0.24);
}

.game-canvas,
.canvas-placeholder {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
}

.next-preview-rail {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 4px;
  z-index: 4;
  height: 10px;
  border-radius: 6px;
  box-shadow: inset 2px 2px 0 rgba(255, 255, 255, 0.22);
  transform-origin: center;
  transition: background-color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
  animation: next-preview-reveal 0.18s ease both;
}

.next-preview-rail.is-changing {
  animation: next-preview-in 0.24s ease both;
}

.dom-board {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  border-radius: 14px;
  background: linear-gradient(180deg, #42545f, #29343d);
}

.dom-block {
  position: absolute;
  box-sizing: border-box;
  border-radius: 4px;
  background-clip: content-box;
  transition: left 0.08s ease, top 0.08s linear;
}

.dom-block::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 12px;
  top: 4px;
  height: 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
}

.dom-block.active {
  z-index: 3;
}

.game-touch-layer {
  position: absolute;
  inset: 0;
  z-index: 20;
  border-radius: 14px;
  background: transparent;
}

.start-page {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #d7d0c6, #c7beb2);
  animation: fade-in 0.24s ease both;
}

.start-content {
  width: min(360px, calc(100% - 48px));
  padding: 0 8px;
  box-sizing: border-box;
  text-align: center;
}

.start-title {
  display: block;
  color: #243038;
  font-size: 28px;
  font-weight: 700;
}

.start-subtitle {
  display: block;
  margin-top: 8px;
  color: #756c64;
  font-size: 15px;
}

.start-btn,
.start-guide-btn,
.setup-start-btn {
  width: 100%;
  min-height: 48px;
  border-radius: 20px;
  font-size: 17px;
  font-weight: 600;
  transition: transform 0.16s ease, filter 0.16s ease, background 0.16s ease;
}

.start-btn:active,
.start-guide-btn:active,
.setup-start-btn:active,
.mode-btn:active,
.quick-score-btn:active,
.setup-option:active,
.overlay-primary:active,
.overlay-secondary:active {
  transform: scale(0.96);
}

.start-btn,
.setup-start-btn {
  margin-top: 24px;
  background: linear-gradient(135deg, #8f9f88, #6f806a);
  color: #faf7f2;
}

.start-guide-btn {
  margin-top: 12px;
  border: 1.5px solid rgba(88, 84, 80, 0.18);
  background: rgba(255, 255, 255, 0.6);
  color: #4e4944;
}

.mode-select {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  animation: fade-in 0.22s ease both;
}

.mode-select-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(180deg, #d7d0c6, #c7beb2);
}

.mode-select-content {
  position: relative;
  z-index: 1;
  width: min(393px, 100%);
  height: 100%;
  box-sizing: border-box;
  padding: 128px 24px calc(28px + env(safe-area-inset-bottom, 0px));
}

.setup-block {
  padding: 26px 26px;
  border: 1px solid rgba(255, 255, 255, 0.48);
  border-radius: 20px;
  background: rgba(248, 243, 235, 0.82);
  box-shadow: 0 10px 28px rgba(76, 70, 62, 0.12);
  animation: rise-in 0.26s ease both;
}

.setup-block + .setup-block {
  margin-top: 16px;
}

.setup-title {
  display: block;
  margin-bottom: 16px;
  color: #243038;
  font-size: 22px;
  font-weight: 700;
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 86px;
  padding: 16px 14px;
  border: 1.5px solid rgba(88, 84, 80, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.mode-btn.selected,
.quick-score-btn.selected,
.setup-option.selected {
  border-color: #8f9f88;
  background: rgba(143, 159, 136, 0.18);
}

.mode-btn-title,
.mode-btn-desc {
  display: block;
  text-align: center;
}

.mode-btn-title {
  color: #243038;
  font-size: 16px;
  font-weight: 600;
}

.mode-btn-desc {
  margin-top: 6px;
  color: #756c64;
  font-size: 12px;
}

.quick-score-select {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 18px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(231, 225, 217, 0.45);
}

.quick-score-label {
  grid-column: 1 / -1;
  color: #756c64;
  font-size: 13px;
}

.quick-score-btn,
.quick-custom-score,
.setup-option {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border: 1.5px solid rgba(88, 84, 80, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: #243038;
  font-size: 15px;
  transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
}

.quick-custom-score {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 12px;
  box-sizing: border-box;
}

.quick-custom-input {
  width: 72px;
  height: 42px;
  color: #243038;
  font-size: 15px;
  line-height: 42px;
  text-align: right;
}

.quick-custom-unit {
  color: #756c64;
  font-size: 14px;
}

.setup-field + .setup-field {
  margin-top: 18px;
}

.setup-label {
  display: block;
  margin-bottom: 10px;
  color: #756c64;
  font-size: 14px;
}

.segmented-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.setup-start-btn {
  margin-top: 22px;
  border-radius: 18px;
}

.game-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(29, 38, 44, 0.5);
  animation: fade-in 0.18s ease both;
}

.overlay-content {
  width: calc(100% - 48px);
  padding: 28px 24px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: 24px;
  background: rgba(248, 243, 235, 0.96);
  box-shadow: 0 14px 32px rgba(40, 52, 60, 0.18);
  text-align: center;
  animation: pop-in 0.2s ease both;
}

.overlay-title {
  display: block;
  color: #243038;
  font-size: 30px;
  font-weight: 600;
}

.overlay-subtitle {
  display: block;
  margin-top: 10px;
  color: #756c64;
  font-size: 15px;
}

.overlay-primary,
.overlay-secondary {
  display: block;
  width: 100%;
  min-height: 58px;
  margin-top: 14px;
  border-radius: 22px;
  font-size: 20px;
}

.overlay-primary {
  margin-top: 18px;
  background: linear-gradient(135deg, #8f9f88, #6f806a);
  color: #faf7f2;
  font-weight: 700;
}

.overlay-secondary {
  background: rgba(250, 248, 244, 0.92);
  color: #4e4944;
  font-weight: 500;
}

.settings-panel {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  animation: fade-in 0.2s ease both;
}

.settings-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(34, 44, 51, 0.3);
  backdrop-filter: blur(6px);
}

.settings-window {
  position: relative;
  z-index: 1;
  width: min(360px, 100%);
  max-height: calc(100vh - 96px);
  padding: 20px;
  overflow-y: auto;
  border-radius: 24px;
  background: rgba(248, 243, 235, 0.98);
  box-shadow: 0 14px 36px rgba(73, 66, 58, 0.22);
  box-sizing: border-box;
  animation: pop-in 0.2s ease both;
}

.settings-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.settings-action {
  min-height: 48px;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(73, 66, 58, 0.1);
}

.restart-action {
  border: 1.5px solid rgba(143, 159, 136, 0.45);
  background: rgba(250, 248, 244, 0.92);
  color: #4e4944;
}

.continue-action {
  background: linear-gradient(135deg, #8f9f88, #6f806a);
  color: #faf7f2;
}

.settings-action:active {
  transform: scale(0.97);
}

.settings-header {
  display: flex;
  margin-bottom: 16px;
  padding: 3px;
  border-radius: 12px;
  background: rgba(231, 225, 217, 0.5);
}

.tab-btn {
  flex: 1;
  min-height: 38px;
  border-radius: 10px;
  color: #756c64;
  font-size: 15px;
  font-weight: 500;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.tab-btn.active {
  background: rgba(255, 255, 255, 0.9);
  color: #243038;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.tab-content {
  min-height: 120px;
}

.tab-line {
  display: block;
  padding: 12px 0;
  border-bottom: 1px solid rgba(88, 84, 80, 0.12);
  color: #4e4944;
  font-size: 15px;
  line-height: 1.6;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pop-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes next-preview-in {
  0% {
    opacity: 0.25;
    transform: translateY(-4px) scaleX(0.92);
  }
  62% {
    opacity: 1;
    transform: translateY(1px) scaleX(1.02);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scaleX(1);
  }
}

@keyframes next-preview-reveal {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

</style>
