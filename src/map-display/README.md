# map-display

The solve-mode board: the terrain grid overlaid with the solver's per-cell verdict (recommended / confirmed / forced / tentative / eliminated / dug), plus the legend. Cropped to the used region.

## Files

| File              | Role                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ResultGrid.tsx`  | The result-mode grid + legend. Computes each cell's class + glyph from the `Evaluation`. Imports the stylesheet. |
| `legend.tsx`      | `MAP_LEGEND`, `TERRAIN_GLYPH`, `DIG_GLYPH`, `ringShadow` — the display vocabulary.                               |
| `map-display.css` | Result-state cell classes + legend (nested).                                                                     |
| `index.ts`        | Barrel (also exports `OverlaySlot` / `OverlayCellState`).                                                        |

## Feature-agnostic overlay slot

`ResultGrid` takes an optional **`overlaySlot(key, cell) => { node?, className? }`**. For each cell it hands the slot the opaque overlay tag + a little cell state; the slot may override the glyph (`node`) and/or add a background class. The core contains **no** feature glyphs — the dev gopher glyphs (🐁/🐀/🧀/🪤) live only in `dev/gopher`, so they drop from the production bundle. Production passes no slot.

## CSS split

The shared cell/grid substrate (`.cell`, `.grid`, terrain colours) lives in the app shell stylesheet — both the input and result grids use it. The higher-specificity result-state classes layer on top here.
