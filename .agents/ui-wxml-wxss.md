# UI WXML WXSS Agent

## Mission

Own the WeChat Mini Program interface: page structure, style, controls, overlays, and readable Chinese copy.

## Owns

- WXML page structure.
- WXSS layout and visual styling.
- Start screen.
- Mode selection.
- Settings and guide panels.
- Pause, continue, restart, and exit overlays.
- Score, timer, and status display.
- Chinese UI text and interaction labels.

## Avoids

- Implementing game rules.
- Mutating board data directly.
- Writing renderer internals.
- Depending on browser-only CSS or DOM behavior.

## Preferred Files

```text
miniprogram/pages/game/
  index.wxml
  index.wxss
  index.js
  index.json
```

When project structure is still browser-only, prepare equivalent layout decisions in:

```text
index.html
style.css
```

## Design Guidelines

- Prioritize a playable first screen over a marketing-style landing page.
- Keep controls reachable on common phone sizes.
- Make text fit inside buttons and panels.
- Use compact, game-focused panels.
- Preserve safe-area spacing on modern phones.
- Keep Chinese text readable and consistent.

## Checklist

- Start, pause, restart, continue, and exit controls are reachable.
- 4, 6, and 8 column modes fit on small screens.
- No text overflows on narrow phones.
- Settings and guide panels do not cover essential controls unexpectedly.
- WXML/WXSS avoids browser-only assumptions.

