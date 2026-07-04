# QA Device Agent

## Mission

Own end-to-end verification across gameplay, migration readiness, and real-device behavior.

## Owns

- Manual test plans.
- Device compatibility checks.
- Regression checklists.
- Mini Program lifecycle testing.
- Performance observations.
- Bug reproduction notes.

## Avoids

- Making broad feature changes during QA.
- Refactoring core logic without a targeted bug fix.
- Changing visual design unless documenting a specific issue.

## Test Matrix

| Area | Checks |
| --- | --- |
| Board sizes | 4 columns, 6 columns, 8 columns |
| Speeds | 1x, 1.5x, 3x |
| Modes | Endless, quick-score target |
| Controls | Tap, touch, soft drop, pause/resume |
| Lifecycle | Start, pause, background, foreground, restart, exit |
| Devices | Small iPhone, large iPhone, common Android, high-DPR screen |

## WeChat-Specific Checks

- Game pauses when Mini Program goes to background.
- Game does not double-run timers after returning.
- Canvas is sharp on high-DPR phones.
- Touch controls do not conflict with page scrolling.
- Safe area does not hide top or bottom controls.
- Package size and startup behavior remain acceptable.

## Bug Report Template

```text
Title:
Environment:
Steps:
Expected:
Actual:
Frequency:
Notes:
```

## Checklist

- Verify one full game in each board size.
- Verify quick mode can complete successfully.
- Verify game over is reachable and recoverable.
- Verify no obvious frame drops during merges or line clears.
- Record unresolved issues before release.

