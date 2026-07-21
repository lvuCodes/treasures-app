// Framework-agnostic session logic: everything the UI needs to turn a player's
// recorded digs + piece-parts into a recommendation, the confirmed-footprint
// overlay, and the feasible choices for the recorder. Kept free of React so a
// pure-HTML (or any) front end can drive it directly.
import { getOrientations, solve, type Item } from "./solver";
import {
  deriveConfirmedState,
  inferFootprints,
  itemFootprints,
  type FootprintCell,
  type RecordedPart,
} from "./footprint";
export { partGlyphForFootprint } from "./footprint";
import { analyzeArrangements, type JointTarget, type PlacementUnit } from "./arrangement";
import type { Cell, Terrain } from "./cell-state";

// Per-cell dig record. Absent = un-recorded. "cracked" = rock hit once (1 hit
// left). 0 = dug empty. k≥1 = item #k (1-based) found at that cell.
export type DigCode = "cracked" | number;

export interface ItemDims {
  long: number;
  short: number;
}

export function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

// Return a copy of `base` with the rectangle spanning (ar,ac)–(br,bc) — in any
// corner order — set to `value`. Pure: the caller owns the snapshot it fills
// from, so a drag re-fills from a clean base each move (rectangle, not trail).
export function fillRect(
  base: number[][],
  ar: number,
  ac: number,
  br: number,
  bc: number,
  value: number,
): number[][] {
  const [r0, r1] = [Math.min(ar, br), Math.max(ar, br)];
  const [c0, c1] = [Math.min(ac, bc), Math.max(ac, bc)];
  return base.map((row, ri) =>
    row.map((v, ci) => (ri >= r0 && ri <= r1 && ci >= c0 && ci <= c1 ? value : v)),
  );
}

// Part glyphs laid out positionally so a grid of them shows where in the item
// the recorded cell sits. Both layouts are 3 columns wide.
const BOX_LAYOUT: string[][] = [
  ["╔", "╦", "╗"],
  ["╠", "╬", "╣"],
  ["╚", "╩", "╝"],
];
const LINE_LAYOUT: string[][] = [
  ["⬅️", "↔️", "➡️"], // horizontal: start · middle · end
  ["⬆️", "↕️", "⬇️"], // vertical:   top · middle · bottom
];

// The positional glyph grid for an item's shape. 1×1 has a single "whole" cell.
export function partLayout(long: number, short: number): (string | undefined)[][] {
  if (long === 1 && short === 1) return [[undefined]];
  return short === 1 ? LINE_LAYOUT : BOX_LAYOUT;
}

// Left-click cycle for the simple (no-item) outcomes. Soil: hammer→0️⃣. Rock
// gets an extra ⚒️→⛏️ crack stage: hammer→cracked→0️⃣. Items are recorded
// through the recorder modal (so a part/footprint is always chosen).
export function nextDigCode(cur: DigCode | undefined, terrain: number): DigCode {
  if (cur === undefined) return terrain === 2 ? "cracked" : 0;
  return 0; // cracked → empty
}

// Build the structured cell grid the calculator consumes from the raw terrain
// grid (0 wall, 1 soil, 2 rock) plus recorded digs and piece-parts.
export function buildCells(
  grid: number[][],
  dug: Map<string, DigCode>,
  parts: Map<string, string>,
): Cell[][] {
  return grid.map((row, r) =>
    row.map((v, c) => {
      const code = dug.get(cellKey(r, c));
      const terrain: Terrain = v === 0 ? "wall" : v === 2 ? "rock" : "soil";
      const cell: Cell = { terrain, hitsRemaining: v === 2 ? 2 : v === 1 ? 1 : 0 };
      if (code === "cracked")
        cell.hitsRemaining = 1; // rock hit once → 1 left
      else if (code === 0) cell.revealedEmpty = true;
      else if (typeof code === "number" && code >= 1) {
        cell.item = { index: code, part: parts.get(cellKey(r, c)) };
      }
      return cell;
    }),
  );
}

// A footprint must stay in bounds, off walls, and off revealed-empty cells.
function makeBoundsFit(grid: number[][], dug: Map<string, DigCode>) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return (cells: FootprintCell[]) =>
    cells.every(
      ({ row, col }) =>
        row >= 0 &&
        col >= 0 &&
        row < rows &&
        col < cols &&
        grid[row][col] !== 0 &&
        dug.get(cellKey(row, col)) !== 0,
    );
}

// Cells occupied by each recorded item, keyed by item index. An item whose
// placement is still ambiguous reserves the UNION of its candidate footprints
// (the "barked-off" region), so no other item can claim a cell it might cover.
// Computed once per state and reused by every feasibility query.
export function recordedFootprints(
  grid: number[][],
  dug: Map<string, DigCode>,
  parts: Map<string, string>,
  items: ItemDims[],
): Map<number, string[]> {
  const boundsFit = makeBoundsFit(grid, dug);

  // Group every recorded part by item index.
  const partsByItem = new Map<number, RecordedPart[]>();
  for (const [key, code] of dug) {
    if (typeof code !== "number" || code < 1) continue;
    const [r, c] = key.split(",").map(Number);
    const list = partsByItem.get(code) ?? [];
    list.push({ row: r, col: c, glyph: parts.get(key) });
    partsByItem.set(code, list);
  }

  const out = new Map<number, string[]>();
  for (const [code, recParts] of partsByItem) {
    const dims = items[code - 1];
    const union = new Set<string>();
    if (dims) {
      for (const fp of itemFootprints(recParts, dims.long, dims.short, boundsFit)) {
        for (const { row, col } of fp) union.add(cellKey(row, col));
      }
    }
    // Fall back to the recorded cells if no candidate footprint fits.
    if (union.size === 0) for (const p of recParts) union.add(cellKey(p.row, p.col));
    out.set(code, [...union]);
  }
  return out;
}

// Feasible part glyphs for item `itemIndex` at (r,c): positions whose footprint
// stays on diggable, unclaimed cells — never overlapping a wall, a revealed
// cell, or ANOTHER recorded item's footprint. (1×1 yields a set with
// `undefined`.) Pass the shared `footprints` map so other items' footprints are
// inferred once, not once per candidate item.
export function feasibleGlyphs(
  grid: number[][],
  dug: Map<string, DigCode>,
  items: ItemDims[],
  footprints: Map<number, string[]>,
  r: number,
  c: number,
  itemIndex: number,
): Set<string | undefined> {
  const { long, short } = items[itemIndex - 1];
  const otherOccupied = new Set<string>();
  for (const [idx, cells] of footprints) {
    if (idx === itemIndex) continue;
    for (const cell of cells) otherOccupied.add(cell);
  }
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const blocked = (rr: number, cc: number) => {
    if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return true;
    if (grid[rr][cc] === 0) return true; // wall
    // The anchor cell hosts this item — its own dig state (e.g. a 0️⃣ the
    // player is now correcting) doesn't block it; only a wall would.
    if (rr === r && cc === c) return false;
    if (dug.get(cellKey(rr, cc)) === 0) return true; // revealed empty
    return otherOccupied.has(cellKey(rr, cc)); // another item's footprint
  };
  const fits = (cells: FootprintCell[]) => cells.every(({ row, col }) => !blocked(row, col));

  const set = new Set<string | undefined>();
  for (const row of partLayout(long, short)) {
    for (const glyph of row) {
      if (inferFootprints(glyph, r, c, long, short, fits).length > 0) set.add(glyph);
    }
  }
  return set;
}

// "Keep map, reset items" re-pick: the player keeps every found piece and
// declares only the still-hidden pieces to add (`hiddenCounts`, one entry per
// item type). Each found piece is re-indexed into the new combined inventory so
// its recorded dig codes stay valid and point at the same shape; newly-declared
// pieces take fresh indices, so they read as not-yet-found. Returns the new
// per-type counts, the remapped dig map, and the expanded item list to evaluate.
export function remapRepick(
  baseItems: ItemDims[],
  dug: Map<string, DigCode>,
  hiddenCounts: number[],
  itemTypes: ItemDims[],
): { counts: number[]; dug: Map<string, DigCode>; items: ItemDims[] } {
  const typeOf = (d: ItemDims) =>
    itemTypes.findIndex((t) => t.long === d.long && t.short === d.short);

  // Distinct found codes (one per recorded item), grouped by item-type index.
  const foundCodesByType = new Map<number, number[]>();
  for (const code of new Set(dug.values())) {
    if (typeof code !== "number" || code < 1) continue;
    const dims = baseItems[code - 1];
    if (!dims) continue;
    const ti = typeOf(dims);
    if (ti < 0) continue;
    const list = foundCodesByType.get(ti) ?? [];
    list.push(code);
    foundCodesByType.set(ti, list);
  }

  // New counts = kept found pieces of each type + declared hidden of that type.
  const counts = itemTypes.map(
    (_, i) => (foundCodesByType.get(i)?.length ?? 0) + (hiddenCounts[i] ?? 0),
  );

  // Walk the new inventory in item-type order, reserving each type's first slots
  // for its found pieces and mapping their old codes → new (1-based) indices.
  const items: ItemDims[] = [];
  const remap = new Map<number, number>();
  for (let i = 0; i < itemTypes.length; i++) {
    const foundCodes = foundCodesByType.get(i) ?? [];
    for (let k = 0; k < counts[i]; k++) {
      items.push({ long: itemTypes[i].long, short: itemTypes[i].short });
      if (k < foundCodes.length) remap.set(foundCodes[k], items.length);
    }
  }

  // Rewrite dig codes: found item codes remap to their new index; cracked/empty
  // records are position-only and carry over unchanged.
  const newDug = new Map<string, DigCode>();
  for (const [key, code] of dug) {
    if (typeof code === "number" && code >= 1) {
      const nc = remap.get(code);
      if (nc !== undefined) newDug.set(key, nc);
    } else {
      newDug.set(key, code);
    }
  }

  return { counts, dug: newDug, items };
}

export interface Evaluation {
  kind: "ok" | "unsolvable" | "complete";
  top: Set<string>; // recommended dig cells (empty unless kind === "ok")
  eliminated: Set<string>; // diggable cells no remaining item can cover (kind === "ok")
  forced: Set<string>; // undug diggable cells every arrangement must cover (kind === "ok")
  forcedItem: Map<string, number>; // forced cells whose owning item index is deduced
  solved: boolean; // every live cell's occupancy (item vs empty) is determined
  confirmed: Cell[][]; // structured grid with inferred-footprint 🟢/🟩 flags
  located: Set<number>; // item indices whose footprint is pinned (recorded or deduced)
  hammersRemaining: number; // hits to dig out every located-but-undug item cell
}

// Every valid placement of an item on a grid, each a sorted list of flat cell
// indices (row * cols + col). `blockedFn` marks cells unavailable to any item.
function placementsOf(
  dims: ItemDims,
  rows: number,
  cols: number,
  blockedFn: (r: number, c: number) => boolean,
): number[][] {
  const out: number[][] = [];
  for (const { rows: h, cols: w } of getOrientations({
    count: 1,
    long: dims.long,
    short: dims.short,
  })) {
    for (let r = 0; r <= rows - h; r++) {
      for (let c = 0; c <= cols - w; c++) {
        const cells: number[] = [];
        let ok = true;
        for (let dr = 0; dr < h && ok; dr++) {
          for (let dc = 0; dc < w && ok; dc++) {
            if (blockedFn(r + dr, c + dc)) ok = false;
            else cells.push((r + dr) * cols + (c + dc));
          }
        }
        if (ok) out.push(cells.sort((a, b) => a - b));
      }
    }
  }
  return out;
}

// The single source of truth for "given this state, what should the player do?"
// Drives both the recommendation and the display overlay in one pass.
export function evaluate(
  grid: number[][],
  dug: Map<string, DigCode>,
  parts: Map<string, string>,
  items: ItemDims[],
  // Cell keys ("r,c") that stay passable for located-footprint inference even
  // when recorded empty — a revealed-empty cell that may still turn out to host
  // an item. The core does not interpret why a cell is passable; a caller (e.g.
  // an overlay feature) supplies the set.
  passableCells: Set<string> = new Set(),
): Evaluation {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const { grid: confirmed, located } = deriveConfirmedState(
    buildCells(grid, dug, parts),
    new Map(items.map((d, i) => [i + 1, d])),
    passableCells,
  );
  const found = new Set<number>();
  for (const v of dug.values()) if (typeof v === "number" && v >= 1) found.add(v);

  // Recommendation grid: bake walls, revealed-empty, recorded items, and
  // confirmed (definite) footprint cells — but NOT tentative ones. Reserving the
  // ambiguous-footprint union here is exactly what used to starve the remaining
  // items and skew recommendations, so tentative cells stay diggable for scoring.
  const workTop = confirmed.map((row) =>
    row.map((cell) =>
      cell.terrain === "wall" || cell.revealedEmpty || cell.item || cell.confirmed
        ? 0
        : cell.hitsRemaining,
    ),
  );

  const remaining: Item[] = items
    .filter((_, i) => !found.has(i + 1))
    .map((d) => ({ count: 1, long: d.long, short: d.short }));

  // Joint placement model. Cells that no item can ever occupy — walls, revealed-
  // empty cells, and the footprints of found items already pinned to a single
  // placement (located by inference) — are blocked outright. Every other still-
  // unplaced item (a found item whose footprint is still ambiguous, or an unfound
  // item) becomes a mutually-exclusive unit, so they are solved together rather
  // than each reserving its candidate union independently.
  const flat = (r: number, c: number) => r * cols + c;
  const blocked = new Set<number>();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (grid[r][c] === 0 || dug.get(cellKey(r, c)) === 0) blocked.add(flat(r, c));
  const footprints = recordedFootprints(grid, dug, parts, items);
  for (const idx of located) {
    if (!found.has(idx)) continue; // bake only recorded, single-candidate items
    for (const k of footprints.get(idx) ?? []) {
      const [r, c] = k.split(",").map(Number);
      blocked.add(flat(r, c));
    }
  }
  const placeBlocked = (r: number, c: number) =>
    r < 0 || c < 0 || r >= rows || c >= cols || blocked.has(flat(r, c));

  const units: PlacementUnit[] = [];
  // Found-but-ambiguous items: constrained to their candidate footprints.
  const fitsUnit = (cs: FootprintCell[]) => cs.every(({ row, col }) => !placeBlocked(row, col));
  const recPartsByItem = new Map<number, RecordedPart[]>();
  for (const [key, code] of dug) {
    if (typeof code !== "number" || code < 1) continue;
    const [r, c] = key.split(",").map(Number);
    const list = recPartsByItem.get(code) ?? [];
    list.push({ row: r, col: c, glyph: parts.get(key) });
    recPartsByItem.set(code, list);
  }
  for (const [code, recParts] of recPartsByItem) {
    if (located.has(code)) continue; // pinned & baked above
    const dims = items[code - 1];
    if (!dims) continue;
    units.push({
      index: code,
      long: dims.long,
      short: dims.short,
      found: true,
      recorded: recParts.map((p) => flat(p.row, p.col)),
      placements: itemFootprints(recParts, dims.long, dims.short, fitsUnit).map((fp) =>
        fp.map((x) => flat(x.row, x.col)).sort((a, b) => a - b),
      ),
    });
  }
  // Unfound items: every valid placement on the unblocked grid.
  items.forEach((dims, i) => {
    if (found.has(i + 1)) return;
    units.push({
      index: i + 1,
      long: dims.long,
      short: dims.short,
      found: false,
      recorded: [],
      placements: placementsOf(dims, rows, cols, placeBlocked),
    });
  });

  // Targets eligible to be forced/eliminated: undug, unblocked, diggable cells.
  const targets: JointTarget[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (placeBlocked(r, c)) continue;
      const code = dug.get(cellKey(r, c));
      if (typeof code === "number" && code >= 1) continue; // recorded item cell
      targets.push({ flat: flat(r, c), key: cellKey(r, c) });
    }

  const top = new Set<string>();
  const eliminated = new Set<string>();
  const forced = new Set<string>();
  const forcedItem = new Map<string, number>();
  let solved = false;
  let kind: Evaluation["kind"];

  if (remaining.length === 0) {
    kind = "complete";
  } else {
    const joint = analyzeArrangements(units, targets);
    if (!joint.solvable) {
      kind = "unsolvable";
    } else {
      kind = "ok";
      for (const key of joint.eliminated) eliminated.add(key);
      for (const key of joint.forced) forced.add(key);
      for (const [key, idx] of joint.forcedItem) forcedItem.set(key, idx);
      for (const idx of joint.located) located.add(idx);
      solved = joint.solvedRegion;

      // Score only what is still genuinely unknown. A deduced-guaranteed cell is
      // a certainty the board already shows, and the display gives that state
      // precedence over the hammer — leaving it in the ranking lets it outscore
      // every uncertain cell and silently swallow the whole recommendation. An
      // item whose footprint is already pinned is likewise settled, so it must
      // not keep skewing the scores of the items still being hunted.
      const workUnknown = workTop.map((row, r) =>
        row.map((hits, c) => (forced.has(cellKey(r, c)) ? 0 : hits)),
      );
      const unsettled = items
        .filter((_, i) => !found.has(i + 1) && !located.has(i + 1))
        .map((d) => ({ count: 1, long: d.long, short: d.short }));
      for (const cell of solve(workUnknown, unsettled).top) top.add(cellKey(cell.row, cell.col));
    }
  }

  // Hits still needed to dig out every determined-but-undug item cell: the
  // confirmed footprints of recorded items PLUS the forced (deduced-guaranteed)
  // cells. Unioned so a confirmed cell that is also forced is counted once.
  const itemCells = new Set<string>(forced);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) if (confirmed[r][c].confirmed) itemCells.add(cellKey(r, c));
  let hammersRemaining = 0;
  for (const key of itemCells) {
    const [r, c] = key.split(",").map(Number);
    hammersRemaining += confirmed[r][c].hitsRemaining;
  }

  return {
    kind,
    top,
    eliminated,
    forced,
    forcedItem,
    solved,
    confirmed,
    located,
    hammersRemaining,
  };
}
