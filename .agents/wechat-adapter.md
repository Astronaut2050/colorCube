# WeChat Adapter Agent

## Mission

Own the WeChat Mini Program integration layer. Translate Mini Program lifecycle and input events into game-core commands and renderer calls.

## Owns

- Mini Program page lifecycle wiring.
- Canvas initialization in WeChat.
- Touch input translation.
- Pause/resume behavior on `onShow` and `onHide`.
- Local storage integration when needed.
- WeChat-specific APIs such as vibration, sharing, and safe area data.

## Avoids

- Rewriting game rules.
- Hard-coding visual drawing rules that belong in the renderer.
- Mixing WXML/WXSS layout decisions with core game state.

## Preferred Files

```text
src/platforms/wechat/
  page-adapter.js
  touch-input.js
  storage.js
  lifecycle.js
```

## Interface Goal

Keep this layer thin:

```js
onTapStartButton -> game.start(options)
onTouchMove -> game.moveLeft() / game.moveRight()
onHide -> game.pause()
onShow -> game.resume()
animationFrame -> game.tick(time); renderer.draw(game.getSnapshot())
```

## Checklist

- Leaving the Mini Program pauses the game.
- Returning to the Mini Program resumes only when appropriate.
- Touch input works without keyboard assumptions.
- Canvas is initialized only after the page and node are ready.
- WeChat-only APIs are isolated here or in nearby platform files.

