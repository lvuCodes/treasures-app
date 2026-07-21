# map-input

The editable input map: draw terrain by clicking cells (wall → soil → rock → wall) and paint rectangles by dragging.

## Files

| File             | Role                                                                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useMapPaint.ts` | Click-cycle + drag-paint: the transient drag refs, the live size readout, and the window mouse-release listeners (torn down symmetrically). Calls the calculator's pure `fillRect`. |
| `InputGrid.tsx`  | Presentational full-board grid + drag-size readout.                                                                                                                                 |
| `map-input.css`  | The drag-size readout (`.drag-size`).                                                                                                                                               |
| `index.ts`       | Barrel.                                                                                                                                                                             |

## Notes

- The shared cell/grid styling lives in the app shell stylesheet (used by both the input and result grids).
- The shell owns `grid` + `setGrid` (also read by the session and saved-maps) and passes them in.
