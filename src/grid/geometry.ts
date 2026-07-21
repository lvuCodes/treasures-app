// Pure board geometry — the feature-agnostic core every map feature builds on.
// No DOM, no React, no storage: every function is a pure function of its grid
// argument, so the whole module is trivially unit-testable. Terrain codes are
// 0 = wall/empty, 1 = soil/dig, 2 = rock (the solver's convention).

// The board is a fixed SIZE×SIZE square; features crop to the used region.
export const SIZE = 10;

// A fresh all-wall (all-0) SIZE×SIZE grid.
export function emptyGrid(): number[][] {
  return Array.from({ length: SIZE }, () => new Array<number>(SIZE).fill(0));
}

// The inclusive integer range [lo, hi].
export function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

// Clone of `m` with `key` set to `v`, or deleted when `v` is undefined. The
// per-cell state maps (dug / parts / overlay) all share this set-or-delete idiom,
// so an immutable update is one call rather than a hand-rolled copy each time.
export function withEntry<V>(m: Map<string, V>, key: string, v: V | undefined): Map<string, V> {
  const next = new Map(m);
  if (v === undefined) next.delete(key);
  else next.set(key, v);
  return next;
}

// Smallest rectangle containing every non-wall cell (map minimization). An
// all-wall grid has no content, so it falls back to the full board.
export function boundingBox(grid: number[][]) {
  let r0 = SIZE,
    r1 = -1,
    c0 = SIZE,
    c1 = -1;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) {
        r0 = Math.min(r0, r);
        r1 = Math.max(r1, r);
        c0 = Math.min(c0, c);
        c1 = Math.max(c1, c);
      }
    }
  }
  if (r1 < 0) return { r0: 0, r1: SIZE - 1, c0: 0, c1: SIZE - 1 };
  return { r0, r1, c0, c1 };
}

// Re-place a saved map's shape centred in a fresh SIZE×SIZE grid. When the
// margin can't split evenly the extra goes to the right / bottom (e.g. a 5-wide
// shape on a 10-wide grid sits as 2 | 5 | 3).
export function centerGrid(grid: number[][]): number[][] {
  const { r0, r1, c0, c1 } = boundingBox(grid);
  const h = r1 - r0 + 1;
  const w = c1 - c0 + 1;
  const top = Math.floor((SIZE - h) / 2);
  const left = Math.floor((SIZE - w) / 2);
  const out = emptyGrid();
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      out[top + (r - r0)][left + (c - c0)] = grid[r][c];
    }
  }
  return out;
}

// Position-independent signature of a drawn map: its bounding-box crop. An empty
// (all-wall) grid yields "" (never saved); the same shape drawn in a different
// corner yields the same signature, so de-duplication ignores placement.
export function mapSignature(grid: number[][]): string {
  if (grid.every((row) => row.every((v) => v === 0))) return "";
  const { r0, r1, c0, c1 } = boundingBox(grid);
  const cropped: number[][] = [];
  for (let r = r0; r <= r1; r++) cropped.push(grid[r].slice(c0, c1 + 1));
  return JSON.stringify(cropped);
}
