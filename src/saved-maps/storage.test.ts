import { describe, expect, it } from "vitest";
import { emptyGrid } from "../grid";
import { appendMap } from "./storage";

// A fresh grid with the given cells set to `v` (default soil).
function gridWith(cells: [number, number][], v = 1): number[][] {
  const g = emptyGrid();
  for (const [r, c] of cells) g[r][c] = v;
  return g;
}

describe("appendMap", () => {
  it("appends a non-empty, non-duplicate map", () => {
    const grid = gridWith([[0, 0], [0, 1]]);
    const outcome = appendMap([], grid);
    expect(outcome).toEqual({ ok: true, maps: [grid] });
  });

  it("skips an empty (all-wall) draw", () => {
    expect(appendMap([], emptyGrid())).toEqual({ ok: false, reason: "empty" });
  });

  it("skips a placement-independent duplicate", () => {
    const existing = gridWith([[0, 0], [0, 1]]);
    const shifted = gridWith([[5, 6], [5, 7]]); // same shape, different corner
    expect(appendMap([existing], shifted)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("keeps a genuinely different shape", () => {
    const horizontal = gridWith([[0, 0], [0, 1]]);
    const vertical = gridWith([[0, 0], [1, 0]]);
    const outcome = appendMap([horizontal], vertical);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.maps).toHaveLength(2);
  });

  it("deep-clones the appended grid so later live edits don't mutate storage", () => {
    const grid = gridWith([[0, 0]]);
    const outcome = appendMap([], grid);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    grid[0][0] = 2; // mutate the live grid after saving
    expect(outcome.maps[0][0][0]).toBe(1); // stored copy is unaffected
  });

  it("treats different terrain codes in the same footprint as distinct", () => {
    const soil = gridWith([[0, 0], [0, 1]], 1);
    const rock = gridWith([[0, 0], [0, 1]], 2);
    expect(appendMap([soil], rock).ok).toBe(true);
  });
});
