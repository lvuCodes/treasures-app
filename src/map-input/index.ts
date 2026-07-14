// Editable input map: terrain drawing (click-cycle + drag-paint). The hook owns
// the transient paint state; the component renders the grid. The shell wires the
// shared grid + setGrid + locked state in.
export { InputGrid } from "./InputGrid";
export { useMapPaint, type DragSize } from "./useMapPaint";
