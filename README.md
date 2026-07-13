# Treasures App

**Monopoly GO Treasures helper.** Computes the optimal shovel placement on a treasure grid by ranking every cell by the probability that an undiscovered item covers it, normalized by shovel cost. As you dig and record what you find, the recommendations update live until every item is located.

Distributed as a single self-contained HTML file — open in any browser, no install, no server, no tooling. Works offline over `file://`.

## Functionality

### Map and item input

- **10×10 grid.** Each cell cycles through three terrain states by click: **dig** (soil, tan), **rock** (🪨, two shovels to clear), and **wall** (undiggable). Click-and-drag paints rectangular regions.
- **Item table.** Set the count of each item shape to place on the map. Eight shapes are supported — `1×1`, `1×2`, `1×3`, `1×4`, `2×2`, `2×3`, `2×4`, `3×3` — up to 10 items total. Both orientations of each shape are considered automatically.
- **Calculate** locks the map and switches to solve mode.

### Solve mode

- **Dig recommendations.** The solver enumerates every valid placement of every remaining item and produces a per-cell score. The highest-scoring cells are flagged as recommended first digs (⛏️ soil / ⚒️ rock).
- **Recording results.** Left-click a cell to log hits remaining (⚒️ → ⛏️ → 0️⃣). Right-click opens the item selector to place a found item; the rest of that item's footprint auto-populates, and only feasible item/part choices are offered.
- **Live deduction.** As cells are recorded the solver eliminates impossible placements, confirms reserved cells (item edges), and marks tentative cells covered by some-but-not-all remaining candidate placements.
- **Item status.** The item table tracks each piece as ❌ not found, ✅ found (a hit recorded), or 📍 located (placement fully pinned).
- **Completion.** When all items are located the app reports how many hammers remain to clear the map; an unsolvable state prompts a correction of the recorded items.
- **Controls.** ↩️ Undo steps back through recorded hits; **Reset** restarts the session on the same map; **New Map** clears everything.
- **Map legend** explains every cell glyph: hits remaining, recommended hits, unviable hits, possible item edges, found-item hits, and empty/found cells.

### Quality-of-life

- **Themes.** Nine color themes (Grass, Homebrew, Pro, Ocean, Red Sands, Man Page, Novel, Silver, Basic). Selection persists via `localStorage`.
- **Saved maps** persist locally via `localStorage`. All persistence is local-only — no cookies, no analytics, no network requests; nothing leaves the device.

## Development

```bash
npm install
npm run dev            # Vite dev server
npm test               # Run the test suite — pass/fail count
npm run test:watch     # Watch mode
npm run test:verbose   # Vitest verbose reporter — one line per test
npm run build          # Production build → dist/
npm run build:singlefile  # Build, then inline JS/CSS into treasures-app.html
```

## Project Structure

```
src/
  App.tsx              # Full UI — grid, item table, picker, themes, solve loop
  App.css              # App styles (themes, grid, picker, footer)
  index.css            # Theme variables / base styles
  main.tsx             # React entry point
  calculator/
    solver.ts          # Placement engine — per-cell probability scores
    cell-state.ts      # Grid cell-state model and conversions
    footprint.ts       # Item footprint geometry and confirmed-state derivation
    elimination.ts     # Prunes impossible placements as cells are recorded
    session.ts         # Solve-session orchestration consumed by the UI
    walkthrough.ts     # Replays recorded walkthroughs (test support)
    *.test.ts          # Vitest suites (solver, footprint, elimination, session, walkthrough)
    fixtures/          # Test fixtures (maps + extracted level data)
scripts/
  build-singlefile.mjs # Inlines the Vite build into one HTML file
public/                # favicon + icons
```

## Algorithm

For each item — expanded by count, considering both orientations — the solver enumerates all valid placements on the grid: positions where every covered cell is diggable. Each placement contributes a normalized weight (coverage count / total placements for that item) to every cell it covers. The aggregate weight is divided by the cell's shovel cost (rock = 2, dig = 1) — a rock reveals nothing until both shovels land, so cells are ranked by expected reveal per shovel spent. Cells with the highest cost-normalized score are the best first-dig candidates. As cells are recorded, impossible placements are eliminated and the scores recompute against the remaining candidates.

## Build and Delivery

- **Development**: React + Vite + TypeScript.
- **Delivery**: `npm run build:singlefile` produces `dist/`, then inlines the JS and CSS into `treasures-app.html` at the project root — a single dependency-free file that runs by double-click over `file://`.

## Sources

The dig-optimization approach was informed by these battleship probability solvers:

- [C. Liam Brown — Battleship Probability Calculator](https://cliambrown.com/battleship/) ([methodology](https://cliambrown.com/battleship/methodology.php))
- [Noq — Battleship solver](https://www.noq.solutions/battleship)
- [nulliq — Battleship](https://nulliq.dev/posts/battleship/)
