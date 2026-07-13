import { describe, it, expect } from "vitest";
import { remapRepick, evaluate, type DigCode, type ItemDims } from "./session";

// Mirror of the UI's ITEM_TYPES order — remapRepick keys hidden counts to it.
const ITEM_TYPES: ItemDims[] = [
  { long: 1, short: 1 }, // 0: 1×1
  { long: 2, short: 1 }, // 1: 1×2
  { long: 3, short: 1 }, // 2: 1×3
  { long: 4, short: 1 }, // 3: 1×4
  { long: 2, short: 2 }, // 4: 2×2
  { long: 3, short: 2 }, // 5: 2×3
  { long: 4, short: 2 }, // 6: 2×4
  { long: 3, short: 3 }, // 7: 3×3
];

const hidden = (overrides: Record<number, number> = {}) =>
  ITEM_TYPES.map((_, i) => overrides[i] ?? 0);

describe("remapRepick", () => {
  it("keeps contiguous found pieces and appends a declared hidden piece", () => {
    // Found: 1×1 (code 1) and 1×2 (code 2). Declare a hidden 2×2 (type 4).
    const base: ItemDims[] = [ITEM_TYPES[0], ITEM_TYPES[1], ITEM_TYPES[5]];
    const dug = new Map<string, DigCode>([
      ["1,1", 1], // 1×1
      ["2,2", 2], // 1×2 ...
      ["2,3", 2],
    ]);
    const { counts, dug: nd, items } = remapRepick(base, dug, hidden({ 4: 1 }), ITEM_TYPES);

    expect(counts).toEqual([1, 1, 0, 0, 1, 0, 0, 0]);
    expect(items).toEqual([ITEM_TYPES[0], ITEM_TYPES[1], ITEM_TYPES[4]]);
    expect(nd.get("1,1")).toBe(1); // 1×1 stays found
    expect(nd.get("2,2")).toBe(2); // 1×2 stays found
    expect([...nd.values()].includes(3)).toBe(false); // the 2×2 is not found
  });

  it("re-indexes a non-contiguous found piece when an earlier-type hidden is added", () => {
    // Only the 2×3 (code 3 in base) is found; declare a hidden 1×1 (type 0).
    const base: ItemDims[] = [ITEM_TYPES[0], ITEM_TYPES[1], ITEM_TYPES[5]];
    const dug = new Map<string, DigCode>([
      ["0,0", 3], ["0,1", 3], ["0,2", 3],
      ["1,0", 3], ["1,1", 3], ["1,2", 3],
    ]);
    const { counts, dug: nd, items } = remapRepick(base, dug, hidden({ 0: 1 }), ITEM_TYPES);

    expect(counts).toEqual([1, 0, 0, 0, 0, 1, 0, 0]);
    // New order is item-type order: 1×1 (index 1, hidden) then 2×3 (index 2).
    expect(items).toEqual([ITEM_TYPES[0], ITEM_TYPES[5]]);
    // Every 2×3 cell remapped from old code 3 → new code 2.
    expect([...nd.values()].every((v) => v === 2)).toBe(true);
  });

  it("never marks a newly-declared piece as found (the reported bug)", () => {
    // Reproduce the screenshot: 1×1 + 1×2 found, re-pick a single 2×2.
    const base: ItemDims[] = [ITEM_TYPES[0], ITEM_TYPES[1], ITEM_TYPES[5]];
    const dug = new Map<string, DigCode>([["1,1", 1], ["2,1", 2], ["2,2", 2]]);
    const grid = Array.from({ length: 10 }, () => Array(10).fill(1)); // all soil
    const { dug: nd, items } = remapRepick(base, dug, hidden({ 4: 1 }), ITEM_TYPES);

    const result = evaluate(grid, nd, new Map(), items);
    expect(result.kind).not.toBe("complete"); // the 2×2 still needs finding
    expect(result.located.has(3)).toBe(false); // the 2×2 (index 3) is not located
  });
});

describe("evaluate — gopher-revealed item auto-location", () => {
  const I3: ItemDims = { long: 3, short: 1 };
  const soil = () => Array.from({ length: 10 }, () => Array(10).fill(1));

  // Reported bug: a gopher revealed (emptied) the cells an item spans, then the
  // item is logged on one of them via "Revealed item" mode. The item must still
  // auto-locate over the gopher-emptied cells.
  it("locates an item whose footprint spans gopher-revealed-empty cells", () => {
    const dug = new Map<string, DigCode>([["5,3", 0], ["6,3", 0], ["4,3", 1]]);
    const parts = new Map<string, string>([["4,3", "⬆️"]]); // 1×3 vertical, top cap
    const gopherCells = new Set(["4,3", "5,3", "6,3"]);
    const r = evaluate(soil(), dug, parts, [I3], gopherCells);
    expect(r.located.has(1)).toBe(true);
  });

  // Regression guard: outside gopher mode a revealed-empty cell still blocks an
  // item footprint, so the same digs without the gopher set do NOT locate.
  it("still blocks an item over a plain revealed-empty cell (no gopher set)", () => {
    const dug = new Map<string, DigCode>([["5,3", 0], ["6,3", 0], ["4,3", 1]]);
    const parts = new Map<string, string>([["4,3", "⬆️"]]);
    const r = evaluate(soil(), dug, parts, [I3]);
    expect(r.located.has(1)).toBe(false);
  });
});

describe("evaluate — joint placement of identical / ambiguous items", () => {
  // A 3×4 soil rectangle holds exactly two 2×3 pieces, which can only tile as
  // two vertical 3×2 columns (left cols 3–4, right cols 5–6).
  const rect = () => {
    const g = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let r = 3; r <= 5; r++) for (let c = 3; c <= 6; c++) g[r][c] = 1;
    return g;
  };
  const twoBoxes: ItemDims[] = [
    { long: 3, short: 2 }, // code 1
    { long: 3, short: 2 }, // code 2
  ];
  const inCols = (lo: number, hi: number) => {
    const out: string[] = [];
    for (let r = 3; r <= 5; r++) for (let c = lo; c <= hi; c++) out.push(`${r},${c}`);
    return out;
  };

  // Capture 2026-06-24_map-state_001839 (bare map): two interchangeable same-type
  // items. Their positions are determined as a SET even though their labels are
  // not, so the map is solved and each item locates to one column — distinctly
  // coloured, not collapsed onto a single index (the reported bug).
  it("locates both interchangeable same-type items and colours them apart", () => {
    const r = evaluate(rect(), new Map(), new Map(), twoBoxes);
    expect(r.kind).toBe("ok");
    expect(r.solved).toBe(true);
    expect([...r.located].sort()).toEqual([1, 2]);
    expect(r.forced.size).toBe(12); // every cell guaranteed to hold an item
    expect(r.hammersRemaining).toBe(12); // all 12 soil cells still to dig out
    // Each column attributed to a single, distinct item — never all to item 1.
    const owners = inCols(3, 6).map((k) => r.forcedItem.get(k));
    expect(new Set(owners).size).toBe(2);
    for (const k of inCols(3, 4)) expect(r.forcedItem.get(k)).toBe(r.forcedItem.get("3,3"));
    for (const k of inCols(5, 6)) expect(r.forcedItem.get(k)).toBe(r.forcedItem.get("3,6"));
    expect(r.forcedItem.get("3,3")).not.toBe(r.forcedItem.get("3,6"));
  });

  // Capture 2026-06-24_map-state_001642: recording item 1's top-right corner (╗)
  // is a valid placement, yet the old union-reservation reported the board as
  // unsolvable. Joint placement keeps it solvable and pins both pieces.
  it("stays solvable after recording one ambiguous corner of a found item", () => {
    const dug = new Map<string, DigCode>([["3,6", 1]]);
    const parts = new Map<string, string>([["3,6", "╗"]]); // box top-right corner
    const r = evaluate(rect(), dug, parts, twoBoxes);
    expect(r.kind).toBe("ok"); // NOT "unsolvable"
    expect(r.solved).toBe(true);
    expect([...r.located].sort()).toEqual([1, 2]);
    expect(r.hammersRemaining).toBe(11); // 12 cells, the recorded corner already dug
    // The recorded corner pins item 1 to the right column; item 2 takes the left.
    for (const k of inCols(5, 6)) if (k !== "3,6") expect(r.forcedItem.get(k)).toBe(1);
    for (const k of inCols(3, 4)) expect(r.forcedItem.get(k)).toBe(2);
  });
});

describe("evaluate — forced-cell item deduction (capture 183208)", () => {
  // A 3×5 region exactly holds a 2×3 and a 3×3. Recording the 2×3 (at cols 5–6)
  // leaves the 3×3 region (cols 2–4) forced AND uniquely typed → it deduces to
  // the 3×3 (located), and the whole map reads as solved.
  it("deduces the remaining item's region and marks the map solved", () => {
    const grid = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let r = 3; r <= 5; r++) for (let c = 2; c <= 6; c++) grid[r][c] = 1;
    const dug = new Map<string, DigCode>([["4,5", 1]]);
    const parts = new Map<string, string>([["4,5", "╠"]]); // 2×3 left-middle
    const items: ItemDims[] = [
      { long: 3, short: 2 }, // code 1 — recorded
      { long: 3, short: 3 }, // code 2 — to be deduced
    ];
    const r = evaluate(grid, dug, parts, items);
    expect(r.kind).toBe("ok");
    expect(r.solved).toBe(true);
    expect(r.located.has(2)).toBe(true); // the 3×3 is deduced-located
    // every cell of the 3×3 region is forced and attributed to item 2
    for (let row = 3; row <= 5; row++)
      for (let col = 2; col <= 4; col++) expect(r.forcedItem.get(`${row},${col}`)).toBe(2);
  });
});
