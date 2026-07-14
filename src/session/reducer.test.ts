import { describe, expect, it } from "vitest";
import { cellKey, type ItemDims } from "../calculator/session";
import { initSession, sessionReducer } from "./reducer";
import type { SessionState } from "./types";

// The eight item types, mirroring the catalog (dims only — the reducer never
// needs labels).
const ITEM_TYPES: ItemDims[] = [
  { long: 1, short: 1 },
  { long: 2, short: 1 },
  { long: 3, short: 1 },
  { long: 4, short: 1 },
  { long: 2, short: 2 },
  { long: 3, short: 2 },
  { long: 4, short: 2 },
  { long: 3, short: 3 },
];

// A soil-filled board so recorded digs/items have somewhere valid to sit.
function soilGrid(): number[][] {
  return Array.from({ length: 10 }, () => new Array<number>(10).fill(1));
}

const expand = (counts: number[]) =>
  ITEM_TYPES.flatMap((t, i) => Array.from({ length: counts[i] }, () => t));

describe("initSession", () => {
  it("starts empty with counts sized to the catalog", () => {
    const s = initSession(8);
    expect(s.counts).toEqual(new Array(8).fill(0));
    expect(s.result).toBeNull();
    expect(s.dug.size).toBe(0);
    expect(s.history).toEqual([]);
  });
});

describe("changeCount", () => {
  it("increments and decrements, flooring at zero", () => {
    let s = initSession(8);
    s = sessionReducer(s, { type: "changeCount", i: 0, delta: 1 });
    expect(s.counts[0]).toBe(1);
    s = sessionReducer(s, { type: "changeCount", i: 0, delta: -1 });
    expect(s.counts[0]).toBe(0);
    s = sessionReducer(s, { type: "changeCount", i: 0, delta: -1 });
    expect(s.counts[0]).toBe(0); // floored
  });

  it("caps the total inventory at 10", () => {
    let s = initSession(8);
    s = sessionReducer(s, { type: "changeCount", i: 0, delta: 10 }); // clamps? delta once
    // A single +10 sets count to 10 (base 0 + others 0 + 10 = 10, not > 10).
    expect(s.counts[0]).toBe(10);
    s = sessionReducer(s, { type: "changeCount", i: 1, delta: 1 }); // 10 + 1 > 10 → rejected
    expect(s.counts[1]).toBe(0);
  });

  it("is a no-op once locked and not re-picking", () => {
    const locked: SessionState = { ...initSession(8), result: { kind: "ok" } as never };
    const next = sessionReducer(locked, { type: "changeCount", i: 0, delta: 1 });
    expect(next).toBe(locked); // referentially unchanged
  });
});

describe("commit + undo are inverse", () => {
  it("restores dug / parts / overlay exactly after undo", () => {
    const grid = soilGrid();
    const items = expand([1, 0, 0, 0, 0, 0, 0, 0]); // one 1×1
    let s = initSession(8);
    s = { ...s, counts: [1, 0, 0, 0, 0, 0, 0, 0] };
    // Solve so a result exists, then record a cell.
    s = sessionReducer(s, { type: "startSession", grid, items });
    const before = { dug: new Map(s.dug), parts: new Map(s.parts), overlay: new Map(s.overlay) };

    const key = cellKey(3, 4);
    s = sessionReducer(s, {
      type: "commit",
      key,
      dug: 0,
      glyph: undefined,
      overlay: undefined,
      grid,
      items,
    });
    expect(s.dug.get(key)).toBe(0);
    expect(s.history).toHaveLength(1);

    s = sessionReducer(s, { type: "undo", grid, items });
    expect([...s.dug]).toEqual([...before.dug]);
    expect([...s.parts]).toEqual([...before.parts]);
    expect([...s.overlay]).toEqual([...before.overlay]);
    expect(s.history).toHaveLength(0);
  });

  it("round-trips an opaque overlay tag through commit + undo", () => {
    const grid = soilGrid();
    const items = expand([1, 0, 0, 0, 0, 0, 0, 0]);
    let s: SessionState = { ...initSession(8), counts: [1, 0, 0, 0, 0, 0, 0, 0] };
    s = sessionReducer(s, { type: "startSession", grid, items });
    const key = cellKey(2, 2);
    // The reducer never interprets the tag — an arbitrary string round-trips.
    s = sessionReducer(s, { type: "commit", key, dug: 0, glyph: undefined, overlay: "hit", grid, items });
    expect(s.overlay.get(key)).toBe("hit");
    s = sessionReducer(s, { type: "undo", grid, items });
    expect(s.overlay.has(key)).toBe(false);
  });

  it("undo on empty history is a no-op", () => {
    const grid = soilGrid();
    const s = sessionReducer(initSession(8), { type: "startSession", grid, items: expand([1, 0, 0, 0, 0, 0, 0, 0]) });
    const next = sessionReducer(s, { type: "undo", grid, items: [] });
    expect(next).toBe(s);
  });
});

describe("submit", () => {
  it("clears recording and produces a result on a fresh calculate", () => {
    const grid = soilGrid();
    let s: SessionState = { ...initSession(8), counts: [1, 0, 0, 0, 0, 0, 0, 0] };
    s = sessionReducer(s, { type: "submit", grid, items: expand(s.counts), itemTypes: ITEM_TYPES });
    expect(s.result).not.toBeNull();
    expect(s.dug.size).toBe(0);
    expect(s.error).toBe("");
  });
});

describe("resetItems → re-pick", () => {
  it("enters re-pick, snapshots the inventory, and zeroes the counts", () => {
    let s: SessionState = { ...initSession(8), counts: [2, 0, 0, 0, 0, 0, 0, 0] };
    const expanded = expand(s.counts);
    s = sessionReducer(s, { type: "resetItems", expandedItems: expanded });
    expect(s.repick).toBe(true);
    expect(s.repickBase).toEqual(expanded);
    expect(s.counts).toEqual(new Array(8).fill(0));
  });
});

describe("resetToInput / newSession", () => {
  it("resetToInput clears the session and drops the result", () => {
    const grid = soilGrid();
    let s: SessionState = { ...initSession(8), counts: [1, 0, 0, 0, 0, 0, 0, 0] };
    s = sessionReducer(s, { type: "startSession", grid, items: expand(s.counts) });
    s = sessionReducer(s, { type: "resetToInput" });
    expect(s.result).toBeNull();
    expect(s.repick).toBe(false);
    expect(s.dug.size).toBe(0);
  });

  it("newSession also zeroes the counts", () => {
    const grid = soilGrid();
    let s: SessionState = { ...initSession(8), counts: [3, 0, 0, 0, 0, 0, 0, 0] };
    s = sessionReducer(s, { type: "startSession", grid, items: expand(s.counts) });
    s = sessionReducer(s, { type: "newSession" });
    expect(s.counts).toEqual(new Array(8).fill(0));
    expect(s.result).toBeNull();
  });
});
