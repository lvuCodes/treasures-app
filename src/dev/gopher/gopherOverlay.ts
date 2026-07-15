import type { OverlaySlot } from "../../map-display";

// Dev-only overlay slot: paints the gopher glyphs + a gold background for a
// gopher-tagged cell. The map-display core never names gophers; it just hands
// each cell's opaque tag here. Referenced only behind import.meta.env.DEV, so
// it (and its glyphs) drop from the production bundle.
export const gopherOverlay: OverlaySlot = (_key, cell) => {
  if (!cell.tag) return undefined;
  let node: string | undefined;
  if (cell.tag === "initial") node = "🐁";
  else if (cell.tag === "revealed") node = "🐀";
  else if (cell.tag === "hit") {
    if (cell.isCracked) node = "🪤"; // rock cracked by gopher
    else if (cell.isEmpty) node = "🧀"; // soil emptied by gopher
    // a gopher-revealed item falls through to the keycap (node stays undefined)
  }
  return { node, className: "gopher" };
};
