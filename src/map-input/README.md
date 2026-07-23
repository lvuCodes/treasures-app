# map-input

The editable input map: draw terrain by tapping cells (wall → soil → rock → wall) and paint rectangles by dragging with a mouse or finger.

## Files

| File             | Role                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useMapPaint.ts` | Click-cycle + drag-paint unified on Pointer Events (one path for mouse and touch): the transient drag refs, the live size readout, pointer capture, and the window pointer-release listeners (torn down symmetrically). Resolves the cell under a moving finger via `document.elementFromPoint`. Calls the calculator's pure `fillRect`. |
| `InputGrid.tsx`  | Presentational full-board grid + drag-size readout. Cells carry `data-r`/`data-c` for pointer-move cell resolution; `onPointerMove` lives on the grid container.                                                                                                                                                                         |
| `map-input.css`  | The drag-size readout (`.drag-size`) and `touch-action: none` on the input cells so a paint gesture never fights the page's native scroll/zoom.                                                                                                                                                                                          |
| `index.ts`       | Barrel.                                                                                                                                                                                                                                                                                                                                  |

## Notes

- The shared cell/grid styling lives in the app shell stylesheet (used by both the input and result grids).
- The shell owns `grid` + `setGrid` (also read by the session and saved-maps) and passes them in.
