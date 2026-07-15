import { useState } from "react";
import type { MouseEvent } from "react";

// A recorder modal open over cell (r,c), anchored at viewport (x,y). `openLeft`
// flips it to grow leftward from the anchor when there isn't room on the right.
export interface PickerAnchor {
  r: number;
  c: number;
  x: number;
  y: number;
  openLeft: boolean;
}

// Widest the recorder can get (matches .picker max-width) — used to decide
// whether it would overflow the right edge and should flip left instead.
export const PICKER_MAX_WIDTH = 280;

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

  function open(e: MouseEvent, r: number, c: number) {
    // Flip leftward when the modal would run past the right edge of the viewport.
    const openLeft = e.clientX + PICKER_MAX_WIDTH > window.innerWidth;
    setAnchor({ r, c, x: e.clientX, y: e.clientY, openLeft });
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
