# grid

Pure board geometry — the feature-agnostic core the map features (`map-input`, `map-display`, `saved-maps`, `session`) build on. No DOM, no React, no storage; every function is a pure function of its grid argument.

## Files

| File               | Role                                         |
| ------------------ | -------------------------------------------- |
| `geometry.ts`      | The board constant and pure grid transforms. |
| `geometry.test.ts` | Vitest unit tests for every transform.       |
| `index.ts`         | Barrel — the module's public surface.        |

## Terrain-code contract

A grid is a `number[][]` of terrain codes, matching the solver's convention:

| Code | Meaning                   |
| ---- | ------------------------- |
| `0`  | wall / empty (undiggable) |
| `1`  | soil / dig (one hit)      |
| `2`  | rock (two hits)           |

## API

| Export                   | Purpose                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `SIZE`                   | The fixed board dimension (10).                                                                                  |
| `emptyGrid()`            | A fresh all-wall `SIZE×SIZE` grid with independent rows.                                                         |
| `range(lo, hi)`          | The inclusive integer range `[lo, hi]`.                                                                          |
| `withEntry(map, key, v)` | Immutable map set-or-delete (`v === undefined` deletes); shared by the per-cell state maps.                      |
| `boundingBox(grid)`      | The tightest `{r0,r1,c0,c1}` around non-wall cells; full board when all-wall.                                    |
| `centerGrid(grid)`       | Re-place a shape centred in a fresh board (extra margin biased right/bottom).                                    |
| `mapSignature(grid)`     | Placement-independent signature (bounding-box crop); `""` for an all-wall grid. Used to de-duplicate saved maps. |
