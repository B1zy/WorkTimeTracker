// A single floating tooltip element, reused (and reparented) across all day
// rows so drag interactions don't need to create/destroy DOM each time.
// Deliberately a module-level singleton (not React state) to match the
// original vanilla behavior and avoid re-render churn during drag.

import { useCallback } from "react";

let tooltipEl: HTMLDivElement | null = null;

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "drag-tooltip";
    tooltipEl.hidden = true;
    document.body.append(tooltipEl);
  }
  return tooltipEl;
}

export function useDragTooltip() {
  const showTooltip = useCallback((text: string, clientX: number, clientY: number) => {
    const tooltip = getTooltip();
    tooltip.textContent = text;
    tooltip.hidden = false;
    tooltip.style.left = `${clientX}px`;
    tooltip.style.top = `${clientY}px`;
  }, []);

  const hideTooltip = useCallback(() => {
    if (tooltipEl) tooltipEl.hidden = true;
  }, []);

  return { showTooltip, hideTooltip };
}
