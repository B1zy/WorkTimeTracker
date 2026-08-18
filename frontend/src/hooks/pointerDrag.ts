// Shared pointer-drag plumbing for the timeline interactions.
//
// Uses pointer capture rather than document-level listeners: once captured,
// every event for that pointerId retargets to the capturing element, so the
// drag keeps tracking even if the pointer leaves the element.

export interface PointerDragHandlers {
  onMove: (event: PointerEvent) => void;
  onEnd: (event: PointerEvent) => void | Promise<void>;
  /** Fired when the browser takes the gesture away (e.g. it became a scroll). */
  onCancel?: () => void;
}

export function beginPointerDrag(
  target: Element,
  pointerId: number,
  { onMove, onEnd, onCancel }: PointerDragHandlers
): void {
  // Guard: capture can throw if the pointer is already gone.
  try {
    target.setPointerCapture(pointerId);
  } catch {
    /* proceed without capture -- listeners below still work for the common case */
  }

  let finished = false;

  function cleanup() {
    target.removeEventListener("pointermove", handleMove);
    target.removeEventListener("pointerup", handleUp);
    target.removeEventListener("pointercancel", handleCancel);
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
  }

  function handleMove(event: Event) {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerId !== pointerId) return;
    onMove(pointerEvent);
  }

  function handleUp(event: Event) {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerId !== pointerId || finished) return;
    finished = true;
    cleanup();
    void onEnd(pointerEvent);
  }

  // pointercancel fires *instead of* pointerup when the browser reclaims the
  // gesture. Without handling it, drag visuals would be left stuck on screen.
  function handleCancel(event: Event) {
    const pointerEvent = event as PointerEvent;
    if (pointerEvent.pointerId !== pointerId || finished) return;
    finished = true;
    cleanup();
    onCancel?.();
  }

  target.addEventListener("pointermove", handleMove);
  target.addEventListener("pointerup", handleUp);
  target.addEventListener("pointercancel", handleCancel);
}
