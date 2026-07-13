import { getOrientations, isDiggable, type Item } from "./solver";

export interface GridCell {
  row: number;
  col: number;
}

// All valid placements of an item, each as a sorted list of flat cell indices
// (row * cols + col). A placement is valid when every covered cell is diggable.
function placementsFor(
  grid: number[][],
  item: Item,
  rows: number,
  cols: number,
): number[][] {
  const out: number[][] = [];
  for (const { rows: h, cols: w } of getOrientations(item)) {
    for (let r = 0; r <= rows - h; r++) {
      for (let c = 0; c <= cols - w; c++) {
        const cells: number[] = [];
        let valid = true;
        for (let dr = 0; dr < h && valid; dr++) {
          for (let dc = 0; dc < w && valid; dc++) {
            if (!isDiggable(grid[r + dr][c + dc])) valid = false;
            else cells.push((r + dr) * cols + (c + dc));
          }
        }
        if (valid) out.push(cells);
      }
    }
  }
  return out;
}

function expand(items: Item[]): Item[] {
  return items.flatMap((it) => Array.from({ length: it.count }, () => it));
}

// Can the items at `remaining` indices be placed without overlapping `occupied`
// or each other? Backtracking, short-circuits on the first complete placement.
// `remaining` is processed fewest-placements-first for faster pruning.
function placeable(
  plPerItem: number[][][],
  remaining: number[],
  occupied: Set<number>,
): boolean {
  if (remaining.length === 0) return true;
  const ordered = [...remaining].sort(
    (a, b) => plPerItem[a].length - plPerItem[b].length,
  );
  const [idx, ...rest] = ordered;
  for (const placement of plPerItem[idx]) {
    if (placement.some((k) => occupied.has(k))) continue;
    for (const k of placement) occupied.add(k);
    const ok = placeable(plPerItem, rest, occupied);
    for (const k of placement) occupied.delete(k);
    if (ok) return true;
  }
  return false;
}

// True when every remaining item can be placed at once without overlap. A
// false result is the unsolvable trigger (over-constrained / impossible map).
export function isSolvable(grid: number[][], items: Item[]): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const expanded = expand(items);
  if (expanded.length === 0) return true;
  const plPerItem = expanded.map((it) => placementsFor(grid, it, rows, cols));
  return placeable(
    plPerItem,
    expanded.map((_, i) => i),
    new Set(),
  );
}

// Eliminated cells: diggable cells that no complete non-overlapping placement of
// all remaining items can cover. A cell is "live" if some item has a placement
// over it that leaves the other items placeable; otherwise it is eliminated
// (painted 🔴 rock / 🟥 soil — caller maps terrain from the grid value).
export function deriveEliminations(grid: number[][], items: Item[]): GridCell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const expanded = expand(items);
  const plPerItem = expanded.map((it) => placementsFor(grid, it, rows, cols));
  const allIdx = expanded.map((_, i) => i);

  const out: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isDiggable(grid[r][c])) continue;
      const target = r * cols + c;

      let live = false;
      for (let i = 0; i < expanded.length && !live; i++) {
        for (const placement of plPerItem[i]) {
          if (!placement.includes(target)) continue;
          const occupied = new Set(placement);
          const rest = allIdx.filter((x) => x !== i);
          if (placeable(plPerItem, rest, occupied)) {
            live = true;
            break;
          }
        }
      }
      if (!live) out.push({ row: r, col: c });
    }
  }
  return out;
}

// Forced cells: diggable cells that EVERY complete non-overlapping placement of
// all remaining items must cover. A cell is forced when blocking it (making it
// non-diggable) leaves the items unplaceable — i.e. no valid arrangement avoids
// it, so it is guaranteed to hold an item even before it is dug (painted purple
// 🟣 rock / 🟪 soil — caller maps terrain from the grid value). The owning item
// may still be ambiguous; that determination is left to the caller.
//
// Cost is `liveCells × isSolvable`; boards are bounding-box cropped so this is
// cheap. It could be memoized against the placement sets if it ever matters.
export function deriveForced(grid: number[][], items: Item[]): GridCell[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (expand(items).length === 0) return [];

  const out: GridCell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isDiggable(grid[r][c])) continue;
      // Block this one cell and ask whether the items still fit. If they don't,
      // every solution needed this cell → it is forced.
      const blocked = grid.map((row) => [...row]);
      blocked[r][c] = 0;
      if (!isSolvable(blocked, items)) out.push({ row: r, col: c });
    }
  }
  return out;
}

// For each forced cell, the item dimensions when exactly one item TYPE can ever
// cover it (across all valid arrangements) — i.e. the program can deduce which
// item sits there even before it is dug. Cells where more than one type could
// cover them are omitted (they stay "item, owner unknown" → purple in the UI).
// `forced` is the already-computed forced-cell list, so this only ranks those.
export function deriveForcedItems(
  grid: number[][],
  items: Item[],
  forced: GridCell[],
): Map<string, { long: number; short: number }> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const expanded = expand(items);
  const plPerItem = expanded.map((it) => placementsFor(grid, it, rows, cols));
  const allIdx = expanded.map((_, i) => i);

  const out = new Map<string, { long: number; short: number }>();
  for (const { row: r, col: c } of forced) {
    const target = r * cols + c;
    // Which distinct item types can cover this cell in some valid arrangement?
    const types = new Map<string, { long: number; short: number }>();
    for (let i = 0; i < expanded.length; i++) {
      const sig = `${expanded[i].long},${expanded[i].short}`;
      if (types.has(sig)) continue; // this type already proven possible here
      for (const placement of plPerItem[i]) {
        if (!placement.includes(target)) continue;
        const rest = allIdx.filter((x) => x !== i);
        if (placeable(plPerItem, rest, new Set(placement))) {
          types.set(sig, { long: expanded[i].long, short: expanded[i].short });
          break;
        }
      }
    }
    if (types.size === 1) out.set(`${r},${c}`, [...types.values()][0]);
  }
  return out;
}
