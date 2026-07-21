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
- **About panel.** A footer toggle opens a right-hand sidebar covering the app's purpose, a plain-language overview, the ranking mechanism, the roadmap, and the local-only privacy posture. It scoots the app aside on wide screens and covers it on narrow ones.

## Development

```bash
npm install
npm run dev            # Vite dev server
npm test               # Run the test suite — pass/fail count
npm run test:watch     # Watch mode
npm run test:verbose   # Vitest verbose reporter — one line per test
npm run build          # Production build → dist/
npm run build:singlefile  # Build, then inline JS/CSS into treasures-app.html
npm run test:coverage  # Run the suite with coverage thresholds enforced
npm run lint           # ESLint
```

CI (`.github/workflows/deploy.yml`) runs lint, `tsc -b`, the coverage-gated suite, and `build:singlefile` on every push and pull request. Pushes to `main` that clear those checks build the site and deploy it to GitHub Pages at [lvucodes.github.io/treasures-app](https://lvucodes.github.io/treasures-app/); pull requests are validated but not deployed.

## Project Structure

Organized by feature/domain, with a feature-agnostic core underneath. `App.tsx` is a thin composition shell that wires the hooks + features together. Each feature folder is a drop-in with its own barrel `index.ts`, colocated CSS, and (where it holds logic) co-located tests; several carry a `README.md`.

```
src/
  App.tsx              # Composition shell — wires the hooks + features
  App.css              # Shell layout + shared cell/grid substrate
  index.css            # Theme variables / base styles
  main.tsx             # React entry point

  # ---- core (feature-agnostic) ----
  grid/                # Pure board geometry (crop, re-centre, signature)
  calculator/          # Pure decision engine (solver, footprint, elimination, session, …)
  session/             # The coupled state machine — pure reducer + useDigSession hook

  # ---- features / cohesion modules ----
  theme/               # Terminal themes (palette + useTheme + switcher)
  map-input/           # Editable input grid (click-cycle + drag-paint)
  map-display/         # Solve-mode board + legend (+ overlay slot)
  inventory/           # Item catalog + status table + steppers
  recorder/            # Right-click item/part picker modal
  saved-maps/          # Persisted map carousel
  about/               # About panel (footer toggle + sidebar)

  # ---- the one release-detachable feature (dropped from prod) ----
  dev/                 # gopher / capture — behind import.meta.env.DEV

scripts/
  build-singlefile.mjs # Inlines the Vite build into one HTML file (+ subset-release guard)
public/                # favicon + icons
```

The boundaries are real: deleting a feature is removing its folder plus its import/registration lines, no core edits. The build-time subset boundary is `dev/` — it is tree-shaken out of the production bundle (enforced by the single-file build's dev-sentinel guard).

## Algorithm

For each item — expanded by count, considering both orientations — the solver enumerates all valid placements on the grid: positions where every covered cell is diggable. Each placement contributes a normalized weight (coverage count / total placements for that item) to every cell it covers. The aggregate weight is divided by the cell's shovel cost (rock = 2, dig = 1) — a rock reveals nothing until both shovels land, so cells are ranked by expected reveal per shovel spent. Cells with the highest cost-normalized score are the best first-dig candidates. As cells are recorded, impossible placements are eliminated and the scores recompute against the remaining candidates.

## Build and Delivery

- **Development**: React + Vite + TypeScript.
- **Delivery**: `npm run build:singlefile` produces `dist/`, then inlines the JS and CSS into `treasures-app.html` at the project root — a single self-contained file (no server, no separate assets) that runs by double-click over `file://`. It still bundles the React runtime; it is "single-file", not vanilla JS. The file is generated locally and gitignored, not committed. The build fails if any dev-only code leaks into it.

## Sources

The dig-optimization approach was informed by these battleship probability solvers:

- [C. Liam Brown — Battleship Probability Calculator](https://cliambrown.com/battleship/) ([methodology](https://cliambrown.com/battleship/methodology.php))
- [Noq — Battleship solver](https://www.noq.solutions/battleship)
- [nulliq — Battleship](https://nulliq.dev/posts/battleship/)
