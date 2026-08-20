// Drag-to-reorder for the Settings panel's cards.
//
// The dragged card is rendered as a fixed-position clone glued to absolute
// viewport coordinates (pointer position minus where it was grabbed), which
// is immune to any layout churn happening underneath it -- unlike a CSS
// transform relative to the card's own (possibly-just-swapped) grid cell,
// which would drift away from the cursor by a cell's width/height every time
// a swap moved that cell. SortableSection also renders an invisible
// placeholder in the card's live grid slot while it's floating, so picking
// it up doesn't itself trigger a reflow (every sibling instantly compacting
// into the gap) -- that reflow-on-pickup, not the drag math, is what made
// moving in one direction feel like it was fighting back.
//
// registerItemRef tracks each card's *grid cell wrapper*, not the card
// itself -- cards are intentionally shrink-to-content and top-aligned within
// their row (see .settings-grid-cell in index.css), so a short card's own
// rect can be much smaller than the row it's in. Hit-testing against the
// card's own rect made a tall card several rows away routinely "win" the
// nearest-center fallback over a short card actually under the pointer;
// the wrapper always spans the card's true cell, so that's what a drop
// target is actually measured against.
//
// Reordering is live: whichever sibling's rect the pointer is currently over
// swaps (transposes) with the dragged card's slot immediately, matching most
// sortable-list/grid UIs. There's no visible grid to align to; "snapping" is
// just that a card only ever renders in one of the grid's real cell
// positions, never anything in between.
//
// The whole card is the drag surface once editing is on (see SettingsPanel),
// not a separate handle button -- press and hold anywhere on it that isn't
// an actual control (input/select/button) and it starts moving with you.

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { beginPointerDrag } from "./pointerDrag";

const MOUSE_MOVE_THRESHOLD_PX = 4;
const TOUCH_MOVE_THRESHOLD_PX = 10;

const INTERACTIVE_SELECTOR = "input, select, textarea, button, a[href], [contenteditable='true']";

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null;
}

export interface DragRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UseSectionReorderOptions {
  order: string[];
  onReorder: (next: string[]) => void;
}

export interface UseSectionReorderResult {
  draggingId: string | null;
  dragRect: DragRect | null;
  registerItemRef: (id: string, el: HTMLElement | null) => void;
  getSurfaceProps: (id: string) => { onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void };
}

export function useSectionReorder({ order, onReorder }: UseSectionReorderOptions): UseSectionReorderResult {
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const orderRef = useRef(order);
  orderRef.current = order;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  // The id most recently swapped with the dragged card. Swapping A and B
  // moves B into A's old spot -- right where the pointer still is -- so
  // without this, the very next move re-detects B as closest and instantly
  // swaps back, and so on for as long as the pointer sits near that
  // boundary. Suppressing an immediate repeat of the *same* target (while
  // still allowing a swap with any *other* target) breaks that ping-pong
  // without needing real directional tracking.
  const lastSwapTargetRef = useRef<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragRect, setDragRect] = useState<DragRect | null>(null);

  const registerItemRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el);
    else itemRefs.current.delete(id);
  }, []);

  const getSurfaceProps = useCallback(
    (id: string) => ({
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        if (event.button !== 0) return;
        // A press on a real control inside the card (the weekly-target
        // number input, a work-day chip, Export backup, ...) should behave
        // normally -- only a press on the card's own surface starts a drag.
        if (isInteractiveTarget(event.target)) return;

        event.preventDefault();
        lastSwapTargetRef.current = null;

        // The pressed card's own visible bounds (not its grid cell, which
        // may be taller -- see registerItemRef) -- this sizes and positions
        // the floating clone, so it matches what was actually grabbed.
        const startRect = event.currentTarget.getBoundingClientRect();
        const grabDx = event.clientX - startRect.left;
        const grabDy = event.clientY - startRect.top;

        const startX = event.clientX;
        const startY = event.clientY;
        const threshold = event.pointerType === "mouse" ? MOUSE_MOVE_THRESHOLD_PX : TOUCH_MOVE_THRESHOLD_PX;
        let moved = false;

        // Captured on document.body, not the pressed card: the card that's
        // actually in the DOM changes identity the moment the drag starts
        // (SortableSection swaps in a wrapper + floating clone in place of
        // the plain card -- see below), and a captured element that gets
        // unmounted implicitly releases capture, silently killing these
        // listeners after exactly one move. body never unmounts.
        beginPointerDrag(document.body, event.pointerId, {
          onMove(moveEvent) {
            if (!moved) {
              const dx = moveEvent.clientX - startX;
              const dy = moveEvent.clientY - startY;
              if (Math.hypot(dx, dy) < threshold) return;
              moved = true;
              setDraggingId(id);
            }

            // Absolute viewport coordinates -- correct regardless of how
            // many times the card's underlying grid slot has swapped since
            // pickup, unlike a delta from the drag's start point would be.
            setDragRect({
              left: moveEvent.clientX - grabDx,
              top: moveEvent.clientY - grabDy,
              width: startRect.width,
              height: startRect.height,
            });

            // Hit-test the pointer against every other card's current rect --
            // distance to the rect's *nearest edge* (0 if the pointer is
            // actually inside it), not to its center. Center-distance let a
            // card directly below/above the drag's start win over a same-row
            // card the pointer just hadn't reached yet: a short vertical gap
            // to a lower row's center can easily be smaller than a long
            // horizontal gap to a same-row card's center, even though the
            // pointer is clearly still "in" that row.
            let targetId: string | null = null;
            let bestDist = Infinity;
            for (const [otherId, el] of itemRefs.current) {
              if (otherId === id) continue;
              const rect = el.getBoundingClientRect();
              const dx = Math.max(rect.left - moveEvent.clientX, 0, moveEvent.clientX - rect.right);
              const dy = Math.max(rect.top - moveEvent.clientY, 0, moveEvent.clientY - rect.bottom);
              const dist = Math.hypot(dx, dy);
              if (dist < bestDist) {
                bestDist = dist;
                targetId = otherId;
              }
            }

            if (targetId && targetId !== lastSwapTargetRef.current) {
              const current = orderRef.current;
              const fromIndex = current.indexOf(id);
              const toIndex = current.indexOf(targetId);
              if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
                const next = current.slice();
                [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
                lastSwapTargetRef.current = targetId;
                onReorderRef.current(next);
              }
            }
          },

          onEnd() {
            setDraggingId(null);
            setDragRect(null);
          },

          onCancel() {
            setDraggingId(null);
            setDragRect(null);
          },
        });
      },
    }),
    []
  );

  return { draggingId, dragRect, registerItemRef, getSurfaceProps };
}
