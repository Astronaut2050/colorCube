# 彩块叠叠音效需求规划

## 1. 玩法解读

当前小游戏是一个纵向下落、同级合成、整行消除的休闲益智玩法。

- 棋盘默认 11 行、4 列，也支持 4 / 6 / 8 列配置。
- 当前方块从顶部生成，自动下落。
- 玩家通过左右滑动移动当前方块，通过下滑触发加速下落。
- 当前方块落到同等级方块上时会合成升级并得分。
- 当一整行都被同等级方块填满时，该行消除并得分。
- 快速模式下，分数达到目标值后胜利。
- 顶部无法继续生成方块时游戏结束。

核心事件已经由 `src/core/game.js` 和 `src/core/rules.js` 产出：

- `spawn`：新方块生成。
- `move`：左右移动成功。
- `lock`：方块落地并固定。
- `merge`：同级方块合成。
- `lineClear`：整行消除。
- `pause` / `resume` / `exit`：暂停、恢复、退出。
- `won` / `gameOver`：胜利、失败。

因此音效接入建议优先监听游戏事件，再补充 UI 按钮点击音效。

## 2. 音效设计目标

音效应服务于三个体验目标：

1. 操作反馈：让玩家知道滑动、点击、加速已经被识别。
2. 正反馈强化：合成、消除、胜利要有轻快奖励感。
3. 状态提示：失败、暂停、返回等状态变化要清楚但不打扰。

建议整体风格：

- 清脆、短促、轻电子、偏治愈。
- 不使用过重低频，避免手机外放浑浊。
- 不使用刺耳失败音，失败提示应柔和但明确。
- 高频动作音量低，奖励音效音量稍高。

## 3. 第一阶段必须添加的音效场景

| 场景 | 触发来源 | 建议音效 key | 优先级 | 说明 |
| --- | --- | --- | --- | --- |
| 开始按钮 | 首页 `start`、设置页 `start_game` | `ui_start` | P0 | 用户进入游戏流程或开局时播放，建立启动反馈。 |
| 普通按钮点击 | 设置、返回、继续、重开、退出、标签切换 | `ui_tap` | P0 | 所有非危险 UI 点击统一使用轻点击音。 |
| 选项切换 | 模式、分数、列数、速度选择 | `ui_select` | P0 | 比普通点击稍亮，表示选项已生效。 |
| 左右移动成功 | `move` 事件 | `piece_move` | P0 | 只在移动成功时播放，撞墙或被挡不播放或播放弱失败音。 |
| 无效左右移动 | `game.moveLeft()` / `game.moveRight()` 返回 `false` | `piece_blocked` | P1 | 可选，音量很低，避免误操作时烦躁。 |
| 加速下落开始 | 下滑触发 `softDropStart()` | `piece_soft_drop` | P0 | 一次下滑只播放一次，不随每格下落重复播放。 |
| 方块固定 | `lock` 事件 | `piece_lock` | P0 | 普通落地反馈，短而柔。 |
| 同级合成 | `merge` 事件 | `piece_merge` | P0 | 核心爽点，建议随 level 或连锁次数略微升调。 |
| 整行消除 | `lineClear` 事件 | `line_clear` | P0 | 比合成更亮，和当前 220ms 消除动画同步。 |
| 胜利 | `won` 事件 | `game_win` | P0 | 快速模式达标时播放一次。 |
| 失败 | `gameOver` 事件 | `game_over` | P0 | 顶部堆满时播放一次，柔和下行音。 |

## 4. 第二阶段可选音效场景

| 场景 | 触发来源 | 建议音效 key | 优先级 | 说明 |
| --- | --- | --- | --- | --- |
| 新方块生成 | `spawn` 事件 | `piece_spawn` | P1 | 可与顶部下一块预览变形动画配合，但音量必须低。 |
| 下一块预览出现 | 渲染层 `nextPreviewVisible` 首次出现 | `next_preview` | P2 | 目前只是视觉辅助，不建议第一版加。 |
| 暂停 | `pause` 事件，手动暂停时 | `game_pause` | P1 | 后台自动暂停不播放。 |
| 恢复 | `resume` 事件，手动恢复时 | `game_resume` | P1 | 从设置面板继续游戏时播放。 |
| 分数增长 | `score` 变化 | `score_bump` | P2 | 已有视觉 bump，音效可先由合成/消除覆盖。 |
| 输入框确认 | 自定义目标分输入完成 | `ui_confirm` | P2 | 优先级低，可复用 `ui_select`。 |

## 5. 不建议添加音效的场景

- 自动下落每移动一格：频率高，会造成噪音。
- 每一帧动画更新：不能绑定音效。
- 下一块预览持续显示：这不是用户动作，不需要持续反馈。
- 后台切出导致的自动暂停：用户不一定意识到游戏仍在，不应突然播放声音。
- 首页和设置页循环背景音乐：第一版先不做 BGM，避免影响留存判断。

## 6. 素材清单

第一阶段建议准备 11 个短音效：

| 文件名 | key | 时长建议 | 音量建议 | 声音描述 |
| --- | --- | --- | --- | --- |
| `ui_start.wav` | `ui_start` | 0.25s - 0.5s | 中 | 轻快上扬启动音。 |
| `ui_tap.wav` | `ui_tap` | 0.05s - 0.15s | 低 | 柔和点击、木质或轻电子均可。 |
| `ui_select.wav` | `ui_select` | 0.08s - 0.2s | 低中 | 比点击更明亮的确认音。 |
| `piece_move.wav` | `piece_move` | 0.04s - 0.12s | 低 | 轻微滑动或短 blip。 |
| `piece_blocked.wav` | `piece_blocked` | 0.08s - 0.18s | 低 | 柔和阻挡提示，不刺耳。 |
| `piece_soft_drop.wav` | `piece_soft_drop` | 0.12s - 0.25s | 低中 | 短促下坠、轻 whoosh。 |
| `piece_lock.wav` | `piece_lock` | 0.08s - 0.18s | 低中 | 轻落地、低冲击感。 |
| `piece_merge.wav` | `piece_merge` | 0.15s - 0.35s | 中 | 清脆合成，上扬、带一点 sparkle。 |
| `line_clear.wav` | `line_clear` | 0.25s - 0.55s | 中高 | 明亮扫过或闪光消除。 |
| `game_win.wav` | `game_win` | 0.8s - 1.5s | 中高 | 简短胜利 jingle。 |
| `game_over.wav` | `game_over` | 0.6s - 1.2s | 中 | 柔和下行失败音。 |

发布格式建议：

- 源文件保留 `wav`。
- 小游戏内优先使用压缩后的 `mp3` 或 `aac`，如微信环境兼容良好也可评估 `ogg`。
- 单个短音效尽量控制在 100KB 以内。
- 所有素材放入 `assets/audio/` 或 `sounds/`，命名和 key 保持一致。

## 7. AI 生成音效提示词

可用于一次性生成统一风格素材：

```text
为一款手机休闲益智小游戏生成一组短音效。玩法是彩色方块从顶部下落，玩家左右滑动移动方块，下滑加速，同等级方块会合成升级，整行同色会消除。

整体风格：清脆、轻快、治愈、轻电子、适合手机外放，不刺耳，不厚重，不要人声，不要背景音乐。
格式：wav，48kHz，短音效，干声，不加长混响。

需要生成：
1. ui_start：轻快上扬启动音，0.3秒左右。
2. ui_tap：柔和点击音，0.1秒左右。
3. ui_select：选项确认音，0.15秒左右，比点击更明亮。
4. piece_move：方块左右移动短 blip，0.08秒左右。
5. piece_blocked：无效移动提示，柔和低音，0.12秒左右。
6. piece_soft_drop：短促下坠 whoosh，0.18秒左右。
7. piece_lock：方块落地固定音，0.12秒左右。
8. piece_merge：同级方块合成，上扬 sparkle，0.25秒左右。
9. line_clear：整行消除，明亮扫过音，0.4秒左右。
10. game_win：简短胜利 jingle，1秒左右。
11. game_over：柔和下行失败音，0.8秒左右。
```

## 8. 代码接入建议

建议新增音频模块：

```text
src/audio/
  sound-manager.js
  sound-map.js
assets/audio/
  ui_start.mp3
  ui_tap.mp3
  ...
```

`sound-manager.js` 建议职责：

- 统一创建和复用 `wx.createInnerAudioContext()`。
- 预加载所有短音效。
- 暴露 `play(key)`、`setMuted(value)`、`setVolume(value)`。
- 支持每个 key 的默认音量。
- 对高频音效做冷却，例如 `piece_move` 40ms、`piece_merge` 60ms。
- 游戏进入后台或暂停时停止长音频；第一版没有 BGM，则只需避免后台恢复时误播。

事件接入建议：

1. 在主循环 `refresh()` 后比较 `snapshot.events`，找出未播放过的新事件。
2. 使用事件的 `at + type + 坐标信息` 生成去重 key，避免同一事件在连续 render 中重复播放。
3. 将核心事件映射到音效：

```text
spawn -> piece_spawn，可选
move -> piece_move
lock -> piece_lock
merge -> piece_merge
lineClear -> line_clear
pause(reason === "manual") -> game_pause
resume(reason === "manual") -> game_resume
won -> game_win
gameOver -> game_over
```

4. UI 事件在按钮命中后立即播放：

```text
start/start_game -> ui_start
mode/qscore/cols/speed/tab -> ui_select
continue/restart/exit/settings/backdrop -> ui_tap
```

5. 左右移动失败需要调整现有调用方式：

```text
const moved = dx < 0 ? game.moveLeft() : game.moveRight();
if (!moved) sound.play("piece_blocked");
```

## 9. 音效播放规则

- `game_win` 和 `game_over` 每局最多播放一次。
- `line_clear` 优先级高于同一帧的多个 `merge`，可以同时播放，但需要限制音量叠加。
- 连续多个 `merge` 可有两种方案：
  - 第一版：每个结算周期只播放一次 `piece_merge`。
  - 进阶版：按连锁次数播放不同 pitch 的变体。
- `piece_lock` 和 `piece_merge` 同时出现时，优先播放 `piece_merge`，避免落地音抢合成反馈。
- `piece_move` 高频播放时必须有冷却时间。
- 静音设置应影响所有音效。

## 10. 验收标准

第一版完成后建议按以下标准验收：

- 首页开始、设置页开始、设置选项切换都有明确反馈。
- 左右移动成功只播放 `piece_move`，失败不误播成功音。
- 下滑加速只在手势触发时播放一次。
- 普通落地、合成、整行消除能被听觉区分。
- 胜利和失败音效只播放一次，不因 render 或 snapshot 重复播放。
- 切到后台不会突然播放音效，回到前台不会补播旧事件。
- 静音开关可立即生效。
- 连续快速操作时不爆音、不明显延迟、不重叠成噪声。

## 11. 推荐实施顺序

1. 建立 `sound-map.js` 和 `sound-manager.js`。
2. 使用临时占位音效接入 UI 点击、移动、落地、合成、消除、胜利、失败。
3. 在 `refresh()` 或主循环里做事件去重和事件到音效的映射。
4. 增加静音设置，优先做全局开关，音量滑杆可后置。
5. 替换为正式音效素材。
6. 真机测试微信小游戏环境下的延迟、重叠、后台恢复表现。
7. 根据真机听感调整每个 key 的默认音量和冷却时间。

