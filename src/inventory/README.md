# inventory

The item catalog (the shared item vocabulary) plus the item-panel UI.

## Files

| File                   | Role                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `item-catalog.ts`      | `ITEM_TYPES` (the eight shapes), `KEYCAPS`, `itemColor` / `ITEM_COLOR_COUNT`, `FORCED_COLOR`. Domain data the map-display and recorder also read. |
| `item-catalog.test.ts` | Vitest unit tests (`itemColor` wraparound, catalog shape).                                                                                        |
| `ItemSteppers.tsx`     | Two-column count steppers (thin vs. wide items).                                                                                                  |
| `ItemTable.tsx`        | `ItemStatusTable` (solve-mode roster: not found / found / located) + `FoundKeptTable` (the re-pick "found (kept)" list).                          |
| `inventory.css`        | Item table + steppers (nested).                                                                                                                   |
| `index.ts`             | Barrel.                                                                                                                                           |

## Notes

The catalog is the shared item vocabulary imported by `map-display` and `recorder` as well — these prod cohesion modules import each other freely (only `dev/` is release-detachable). The presentational components take counts/status + callbacks; the session owns the state.
