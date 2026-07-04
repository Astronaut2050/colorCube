const DEFAULT_THRESHOLD = 24;

function pointFromTouch(event) {
  const touch = event.changedTouches?.[0] || event.touches?.[0] || event;
  return {
    x: touch.clientX ?? touch.x ?? 0,
    y: touch.clientY ?? touch.y ?? 0,
  };
}

export function createTouchInput({ onLeft, onRight, onDown, threshold = DEFAULT_THRESHOLD }) {
  let startPoint = null;

  function touchStart(event) {
    startPoint = pointFromTouch(event);
  }

  function touchMove() {
    // The template uses prevent/stop on touchmove to keep the page fixed while playing.
  }

  function touchEnd(event) {
    if (!startPoint) {
      return;
    }

    const endPoint = pointFromTouch(event);
    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    startPoint = null;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
      if (deltaX < 0) {
        onLeft?.();
      } else {
        onRight?.();
      }
      return;
    }

    if (deltaY > threshold && Math.abs(deltaY) >= Math.abs(deltaX)) {
      onDown?.();
    }
  }

  function cancel() {
    startPoint = null;
  }

  return { touchStart, touchMove, touchEnd, cancel };
}
