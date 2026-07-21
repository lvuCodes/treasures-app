# session

The coupled session state machine — the recording cluster (item counts, per-cell `dug` / `parts` / `overlay` maps, undo `history`, and the latest `result`) plus the re-pick flags. Modelled as a **pure reducer** so the highest-coupling part of the app is testable and `undo(commit(s)) === s` is provable.

## Files

| File               | Role                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`         | `SessionState`, `SessionAction`, `HistoryEntry`.                                                                                                                                      |
| `reducer.ts`       | Pure `sessionReducer(state, action)` + `initSession`. No React/DOM.                                                                                                                   |
| `reducer.test.ts`  | Vitest unit tests (commit↔undo inverse, overlay round-trip, cap, re-pick, resets).                                                                                                    |
| `useDigSession.ts` | Thin `useReducer` wrapper: derives the read-models (`expandedItems`, `foundSet`, `repickFound`, `footprints`, `locked`, …) and threads the live grid + item catalog into each action. |
| `index.ts`         | Barrel.                                                                                                                                                                               |

## Feature-agnostic overlay channel

The reducer never names a feature. Per-cell annotations ride an **opaque `overlay: Map<string,string>`** — the core stores and round-trips the tag but never interprets it. The dev gopher tooling is the only current consumer (it stamps `"initial"`/`"revealed"`/`"hit"`); `evaluate` receives `new Set(overlay.keys())` as its generic `passableCells`.

## Seams wired by the shell (kept out of the reducer)

- `onCalculate(grid)` — a config callback fired on a valid submit (used to auto-save the map). Keeps the reducer pure.
- The recorder modal (`picker.close()`) is the shell's; the hook exposes picker-agnostic `commit`/`recordCell`, and the shell wraps them.
- `grid` lives in the shell (edited by `map-input`) and is passed into each action; the board is frozen while a `result` exists, so passing it in is safe.
