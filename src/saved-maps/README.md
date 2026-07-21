# saved-maps

Local retention of drawn map terrain (never item counts), shown as a carousel of mini-map cards. Persists to `localStorage` under one namespaced key; de-duplicates by placement-independent signature so the same shape in a different corner isn't stored twice.

## Files

| File              | Role                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `storage.ts`      | Pure core: the localStorage key, guarded load/persist, and `appendMap` (the non-empty / non-duplicate decision). |
| `storage.test.ts` | Vitest unit tests for `appendMap`.                                                                               |
| `useSavedMaps.ts` | React binding: owns the list, the transient status line, and carousel scroll state.                              |
| `MiniMap.tsx`     | Non-interactive cropped terrain preview (a card face).                                                           |
| `SavedMaps.tsx`   | Presentational carousel; renders nothing when empty. Imports the stylesheet.                                     |
| `saved-maps.css`  | Colocated, token-driven, nested styles.                                                                          |
| `index.ts`        | Barrel.                                                                                                          |

## Usage

```tsx
const saved = useSavedMaps();

<SavedMaps
  maps={saved.maps}
  cardsRef={saved.cardsRef}
  cardEnds={saved.cardEnds}
  onScroll={saved.updateCardEnds}
  onScrollBy={saved.scrollBy}
  onDelete={saved.remove}
  onLoad={(m) => {
    setGrid(centerGrid(m));
    resetSession();
  }}
/>;
```

## Cross-feature seams (wired by the shell, not imported here)

- **Which grid to save** — `saved.save(grid, silent?)` takes the live grid; the shell calls it from the Save button and from the auto-save on Calculate.
- **What load does** — `onLoad(map)` hands the shell the stored terrain; the shell re-centres it into the grid and resets the session.
- **`footerSlot`** — optional extra controls under the carousel (the dev export block); undefined in production.
