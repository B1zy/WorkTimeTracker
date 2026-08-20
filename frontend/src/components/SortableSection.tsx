import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { DragRect } from "../hooks/useSectionReorder";

interface SortableSectionProps {
  id: string;
  isEditing: boolean;
  isDragging: boolean;
  dragRect: DragRect | null;
  registerItemRef: (id: string, el: HTMLElement | null) => void;
  onSurfacePointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  children: ReactNode;
}

// Purely decorative -- see useSectionReorder: the whole card is the drag
// surface while editing, this just signals "grabbable" at a glance.
function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
      {[4, 8, 12].map((cy) =>
        [5, 11].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.1" fill="currentColor" />)
      )}
    </svg>
  );
}

// Wraps one Settings card so it can be picked up and dragged when the panel
// is in "Edit Layout" mode -- see useSectionReorder for the actual drag/swap
// mechanics. Kept as its own component (rather than inlined per-card in
// SettingsPanel) since every card needs the identical ref/style/handler
// wiring regardless of what it contains.
//
// The outer .settings-grid-cell is the real grid item (and what
// registerItemRef tracks) -- it stretches to the row's full height, while
// the .settings-section inside stays its normal shrink-to-content,
// top-aligned self. That split is what makes hit-testing during a drag
// (which measures the wrapper, not the card) work correctly across rows of
// uneven height.
export function SortableSection({
  id,
  isEditing,
  isDragging,
  dragRect,
  registerItemRef,
  onSurfacePointerDown,
  children,
}: SortableSectionProps) {
  if (isDragging && dragRect) {
    const floatingStyle: CSSProperties = {
      position: "fixed",
      left: dragRect.left,
      top: dragRect.top,
      width: dragRect.width,
      height: dragRect.height,
    };

    return (
      <>
        {/* Empty -- just reserves this card's grid cell (via the grid's own
            stretch sizing) so siblings don't reflow just from it being
            picked up. Only an actual swap should move anything. */}
        <div className="settings-grid-cell" ref={(el) => registerItemRef(id, el)} />
        <section className="settings-section is-dragging" style={floatingStyle}>
          <span className="settings-drag-handle" aria-hidden="true">
            <GripIcon />
          </span>
          {children}
        </section>
      </>
    );
  }

  return (
    <div className="settings-grid-cell" ref={(el) => registerItemRef(id, el)}>
      <section
        className={`settings-section${isEditing ? " is-editable" : ""}`}
        onPointerDown={isEditing ? onSurfacePointerDown : undefined}
      >
        {isEditing && (
          <span className="settings-drag-handle" aria-hidden="true">
            <GripIcon />
          </span>
        )}
        {children}
      </section>
    </div>
  );
}
