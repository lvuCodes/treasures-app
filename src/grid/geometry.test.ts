import { describe, expect, it } from "vitest";
import {
  SIZE,
  boundingBox,
  centerGrid,
  emptyGrid,
  mapSignature,
  range,
  withEntry,
} from "./geometry";

// A grid with the given non-wall cells set to `v` (default soil), rest wall.
function gridWith(cells: [number, number][], v = 1): number[][] {
  const g = emptyGrid();
  for (const [r, c] of cells) g[r][c] = v;
  return g;
}

describe("emptyGrid", () => {
  it("is a fresh SIZE×SIZE all-wall grid with no shared rows", () => {
    const g = emptyGrid();
    expect(g.length).toBe(SIZE);
    expect(g.every((row) => row.length === SIZE)).toBe(true);
    expect(g.flat().every((v) => v === 0)).toBe(true);
    g[0][0] = 1;
    expect(g[1][0]).toBe(0); // rows are independent arrays
  });
});

describe("range", () => {
  it("is inclusive of both ends", () => {
    expect(range(2, 5)).toEqual([2, 3, 4, 5]);
    expect(range(3, 3)).toEqual([3]);
  });
});

describe("withEntry", () => {
  it("sets a key without mutating the source", () => {
    const a = new Map([["x", 1]]);
    const b = withEntry(a, "y", 2);
    expect([...b]).toEqual([["x", 1], ["y", 2]]);
    expect(a.has("y")).toBe(false); // source untouched
  });

  it("deletes a key when the value is undefined", () => {
    const a = new Map([["x", 1], ["y", 2]]);
    const b = withEntry(a, "y", undefined);
    expect([...b]).toEqual([["x", 1]]);
    expect(a.has("y")).toBe(true); // source untouched
  });
});

describe("boundingBox", () => {
  it("wraps the used region tightly", () => {
    expect(boundingBox(gridWith([[2, 3], [4, 5]]))).toEqual({ r0: 2, r1: 4, c0: 3, c1: 5 });
  });

  it("falls back to the full board when all-wall", () => {
    expect(boundingBox(emptyGrid())).toEqual({ r0: 0, r1: SIZE - 1, c0: 0, c1: SIZE - 1 });
  });
});

describe("centerGrid", () => {
  it("re-centres a shape, biasing the extra margin right/bottom", () => {
    // A single cell centres to floor((10-1)/2) = 4 on both axes.
    const centred = centerGrid(gridWith([[0, 0]]));
    expect(boundingBox(centred)).toEqual({ r0: 4, r1: 4, c0: 4, c1: 4 });
    expect(centred[4][4]).toBe(1);
  });

  it("preserves the cropped shape (placement-independent)", () => {
    const original = gridWith([[1, 1], [1, 2], [2, 1]]); // an L
    // Re-centring must not change the shape's signature.
    expect(mapSignature(centerGrid(original))).toBe(mapSignature(original));
  });
});

describe("mapSignature", () => {
  it("is empty for an all-wall grid", () => {
    expect(mapSignature(emptyGrid())).toBe("");
  });

  it("is identical for the same shape in different corners", () => {
    const topLeft = gridWith([[0, 0], [0, 1], [1, 0]]);
    const shifted = gridWith([[5, 6], [5, 7], [6, 6]]);
    expect(mapSignature(topLeft)).toBe(mapSignature(shifted));
  });

  it("differs for genuinely different shapes", () => {
    const horizontal = gridWith([[0, 0], [0, 1]]);
    const vertical = gridWith([[0, 0], [1, 0]]);
    expect(mapSignature(horizontal)).not.toBe(mapSignature(vertical));
  });

  it("distinguishes terrain codes within the same footprint", () => {
    const soil = gridWith([[0, 0], [0, 1]], 1);
    const rock = gridWith([[0, 0], [0, 1]], 2);
    expect(mapSignature(soil)).not.toBe(mapSignature(rock));
  });
});
