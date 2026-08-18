// A single visually-hidden aria-live region, shared by every timeline block.
//
// Deliberately a module-level singleton (mirroring useDragTooltip): one region
// per block would make a screen reader announce from whichever element last
// changed, and rapid keyboard adjustments across blocks would interleave.

import { useCallback } from "react";

let regionEl: HTMLDivElement | null = null;

function getRegion(): HTMLDivElement {
  if (!regionEl) {
    regionEl = document.createElement("div");
    regionEl.className = "sr-only";
    regionEl.setAttribute("role", "status");
    regionEl.setAttribute("aria-live", "polite");
    document.body.append(regionEl);
  }
  return regionEl;
}

export function useLiveAnnouncer() {
  const announce = useCallback((message: string) => {
    getRegion().textContent = message;
  }, []);

  return { announce };
}
