# SubAgent Structure

This project is a browser Canvas game today, with a planned migration path to a WeChat Mini Program. The subAgent structure is organized around keeping the game core platform-neutral while isolating rendering, platform integration, interface, and device QA work.

## Agents

| Agent | Main Area | Primary Files |
| --- | --- | --- |
| game-core | Platform-neutral game rules and state | `src/core/` |
| canvas-renderer | Canvas drawing and animation | `src/renderers/` |
| wechat-adapter | WeChat Mini Program integration | `src/platforms/wechat/` |
| ui-wxml-wxss | Mini Program page structure and styles | WeChat `pages/`, `.wxml`, `.wxss` |
| qa-device | End-to-end behavior and device checks | Test notes, checklists, manual QA |

## Collaboration Rules

- Keep game rules independent from DOM, browser-only APIs, and WeChat-only APIs.
- Keep renderers dependent on state snapshots, not on UI controls.
- Keep platform adapters thin: translate platform events into game commands.
- Avoid having multiple agents edit the same file in the same task unless the task explicitly requires it.
- Update this directory when responsibilities change.

## Target Architecture

```text
src/
  core/
    game.js
    board.js
    rules.js
    scoring.js

  renderers/
    web-canvas-renderer.js
    wechat-canvas-renderer.js

  platforms/
    web/
      dom-ui.js
      input.js

    wechat/
      page-adapter.js
      touch-input.js

  shared/
    constants.js
    themes.js
```

