import { useState } from "react";
import type { MouseEvent } from "react";

// A recorder modal open over cell (r,c), pinned at viewport (x,y) — already
// clamped so the whole modal stays inside the map region.
export interface PickerAnchor {
  r: number;
  c: number;
  x: number;
  y: number;
}

// The rectangle the modal must stay inside — the map region (grid + legend).
export interface PickerBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Largest the recorder can get (matches .picker max-width / max-height) — used
// to clamp the anchor so no edge of the modal escapes the map region.
export const PICKER_MAX_WIDTH = 280;
export const PICKER_MAX_HEIGHT = 300;
// Breathing room kept between the modal and the edge it is clamped against.
export const PICKER_MARGIN = 8;

// Pin the modal's top-left so its full box sits inside `bounds`, insetting by
// PICKER_MARGIN. A bounds narrower/shorter than the modal pins it to the
// leading edge (overflowing the trailing one is unavoidable and less bad than
// leaving the title and item grid off-screen).
export function clampAnchor(x: number, y: number, bounds: PickerBounds): { x: number; y: number } {
  const clamp = (v: number, lo: number, hi: number) =>
    hi < lo ? lo : Math.min(Math.max(v, lo), hi);
  return {
    x: clamp(x, bounds.left + PICKER_MARGIN, bounds.right - PICKER_MARGIN - PICKER_MAX_WIDTH),
    y: clamp(y, bounds.top + PICKER_MARGIN, bounds.bottom - PICKER_MARGIN - PICKER_MAX_HEIGHT),
  };
}

// The map region the modal is confined to: the caller's rect (grid + legend)
// intersected with the viewport, so a region scrolled partly out of view still
// yields an on-screen anchor.
export function pickerBounds(region: PickerBounds | null): PickerBounds {
  const view = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  if (!region) return view;
  return {
    left: Math.max(region.left, view.left),
    top: Math.max(region.top, view.top),
    right: Math.min(region.right, view.right),
    bottom: Math.min(region.bottom, view.bottom),
  };
}

// State for the right-click recorder modal. `forceMode` is the feature-agnostic
// "trust the user over the solver" flag (skip feasibility filtering); `overlayTag`
// is the opaque tag stamped on the next recorded item. Both are set by an
// optional feature (e.g. a dev overlay tool) via the recorder's footer slot; in
// the normal flow they stay off/undefined.
export function usePicker() {
  const [anchor, setAnchor] = useState<PickerAnchor | null>(null);
  const [pickerItem, setPickerItem] = useState<number | null>(null);
  const [forceMode, setForceMode] = useState(false);
  const [overlayTag, setOverlayTag] = useState<string | undefined>(undefined);

  function open(e: MouseEvent, r: number, c: number, region: PickerBounds | null = null) {
    const { x, y } = clampAnchor(e.clientX, e.clientY, pickerBounds(region));
    setAnchor({ r, c, x, y });
    setPickerItem(null);
    setForceMode(false);
    setOverlayTag(undefined);
  }

  function close() {
    setAnchor(null);
    setPickerItem(null);
    setForceMode(false);
    setOverlayTag(undefined);
  }

  return {
    anchor,
    pickerItem,
    setPickerItem,
    forceMode,
    setForceMode,
    overlayTag,
    setOverlayTag,
    open,
    close,
  };
}
