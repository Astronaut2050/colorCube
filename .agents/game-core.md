# Game Core Agent

## Mission

Own the platform-neutral game engine. The game should be playable from pure JavaScript state transitions without relying on DOM, Canvas, or WeChat APIs.

## Owns

- Board state and dimensions.
- Piece generation and movement.
- Collision, settling, merging, and line clearing.
- Score calculation.
- Game modes and win/lose conditions.
- Serializable state snapshots for rendering and testing.

## Avoids

- Direct DOM access such as `document.getElementById`.
- Direct Canvas calls.
- Direct WeChat APIs such as `wx.*`.
- CSS, WXML, WXSS, and page layout decisions.

## Preferred Files

```text
src/core/
  game.js
  board.js
  rules.js
  scoring.js
src/shared/
  constants.js
  themes.js
```

## Interface Goal

Expose a small command-based API that platform adapters can call:

```js
game.start(options)
game.pause()
game.resume()
game.moveLeft()
game.moveRight()
game.softDropStart()
game.softDropStop()
game.tick(timestamp)
game.getSnapshot()
```

## Checklist

- The core can run without a browser document.
- The core can run without a Canvas context.
- 4, 6, and 8 column modes still work.
- Endless and quick-score modes still work.
- Game over and win states are deterministic and testable.

