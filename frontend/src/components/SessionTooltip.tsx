import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { WorkSession } from "../types/WorkSession";
import { durationMinutes, formatDuration, formatTimeShort } from "../utils/dateUtils";
import { ENTRY_TYPE_CLASS, ENTRY_TYPE_LABEL, LOCATION_CLASS, LOCATION_LABEL } from "../utils/timelineLayout";

interface SessionTooltipProps {
  session: WorkSession;
  anchorRef: RefObject<HTMLElement | null>;
}

// A styled stand-in for the block's old native `title` tooltip (see
// TimelineBlock) -- portaled straight to <body> so it always floats above
// the timeline regardless of the day row's own stacking, and positions
// itself the same measure-then-place way TimeField's popover does: hidden
// until its own size is known, then placed above the block (or below, if
// there isn't room) and clamped so it never runs off-screen.
export function SessionTooltip({ session, anchorRef }: SessionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    function reposition() {
      const anchor = anchorRef.current;
      const tooltip = tooltipRef.current;
      if (!anchor || !tooltip) return;
      const anchorRect = anchor.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const margin = 8;

      const spaceAbove = anchorRect.top;
      const openBelow = spaceAbove < tooltipRect.height + margin;
      const top = openBelow ? anchorRect.bottom + margin : anchorRect.top - tooltipRect.height - margin;

      const left = Math.min(
        Math.max(anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2, margin),
        window.innerWidth - tooltipRect.width - margin
      );

      setStyle({ position: "fixed", top, left, visibility: "visible" });
    }

    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorRef]);

  const entryTypeClass = ENTRY_TYPE_CLASS[session.entryType];
  const colorClass = entryTypeClass ?? LOCATION_CLASS[session.location] ?? "loc-other";
  const typeLabel = ENTRY_TYPE_LABEL[session.entryType] ?? session.entryType;
  const hasName = session.name.trim().length > 0;
  const displayName = hasName ? session.name : typeLabel;
  // Same "don't say the type twice" rule as the block's own label/title: the
  // header already falls back to the type when there's no real name, so the
  // meta line only repeats it when a real name pushed it out of the header.
  const metaLine = [hasName ? typeLabel : null, entryTypeClass ? null : (LOCATION_LABEL[session.location] ?? session.location)]
    .filter(Boolean)
    .join(" · ");
  const totalMinutes = durationMinutes(session.start, session.end);

  return createPortal(
    <div className="session-tooltip" role="tooltip" ref={tooltipRef} style={style}>
      <div className="session-tooltip-header">
        <span className={`session-tooltip-dot ${colorClass}`} aria-hidden="true" />
        <span className="session-tooltip-name">{displayName}</span>
      </div>
      {metaLine && <div className="session-tooltip-meta">{metaLine}</div>}
      <div className="session-tooltip-time">
        {formatTimeShort(session.start)}–{formatTimeShort(session.end)}
        <span className="session-tooltip-duration"> · {formatDuration(totalMinutes)}</span>
      </div>
      {session.description && <div className="session-tooltip-desc">{session.description}</div>}
    </div>,
    document.body
  );
}
