export function createGameLifecycle(game) {
  let wasAutoPaused = false;

  function handleHide() {
    const snapshot = game.getSnapshot();
    if (snapshot.status === "running") {
      game.pause("background");
      wasAutoPaused = true;
    }
  }

  function handleShow() {
    const snapshot = game.getSnapshot();
    if (wasAutoPaused && snapshot.status === "paused" && snapshot.pauseReason === "background") {
      game.resume("foreground");
    }
    wasAutoPaused = false;
  }

  return { handleHide, handleShow };
}
