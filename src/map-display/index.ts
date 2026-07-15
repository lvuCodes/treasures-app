// Solve-mode board: the terrain grid overlaid with the solver's per-cell verdict,
// plus the legend. A feature can paint its own per-cell glyph/background through
// the `overlaySlot` without the core naming it.
export { ResultGrid, type OverlaySlot, type OverlayCellState } from "./ResultGrid";
export { MAP_LEGEND, TERRAIN_GLYPH, DIG_GLYPH, ringShadow } from "./legend";
