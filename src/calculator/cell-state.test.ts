import { describe, expect, it } from "vitest";
import { cellGlyph, itemEmoji, toNumericGrid, type Cell } from "./cell-state";

const base = (over: Partial<Cell> = {}): Cell => ({
  terrain: "soil",
  hitsRemaining: 1,
  ...over,
});

describe("itemEmoji", () => {
  it("maps 1..10 to keycap emoji", () => {
    expect(itemEmoji(1)).toBe("1️⃣");
    expect(itemEmoji(10)).toBe("🔟");
  });

  it("falls back to the pick glyph outside 1..10", () => {
    expect(itemEmoji(0)).toBe("⛏️");
    expect(itemEmoji(11)).toBe("⛏️");
  });
});

describe("toNumericGrid", () => {
  it("keeps the hit count for plain diggable cells", () => {
    expect(toNumericGrid([[base({ terrain: "soil", hitsRemaining: 1 })]])).toEqual([[1]]);
    expect(toNumericGrid([[base({ terrain: "rock", hitsRemaining: 2 })]])).toEqual([[2]]);
  });

  it("zeroes every non-placeable state", () => {
    const cells: Cell[][] = [
      [
        base({ terrain: "wall" }),
        base({ revealedEmpty: true }),
        base({ item: { index: 1 } }),
        base({ confirmed: true }),
        base({ tentative: true }),
        base({ eliminated: true }),
      ],
    ];
    expect(toNumericGrid(cells)).toEqual([[0, 0, 0, 0, 0, 0]]);
  });
});

describe("cellGlyph", () => {
  it("renders a found item's keycap plus its part", () => {
    expect(cellGlyph(base({ item: { index: 2, part: "L" } }))).toBe("2️⃣L");
    expect(cellGlyph(base({ item: { index: 2 } }))).toBe("2️⃣");
  });

  it("renders revealed-empty", () => {
    expect(cellGlyph(base({ revealedEmpty: true }))).toBe("0️⃣");
  });

  it("distinguishes confirmed rock vs soil by remaining hits", () => {
    expect(cellGlyph(base({ confirmed: true, hitsRemaining: 2 }))).toBe("🟢");
    expect(cellGlyph(base({ confirmed: true, hitsRemaining: 1 }))).toBe("🟩");
  });

  it("distinguishes tentative by terrain", () => {
    expect(cellGlyph(base({ tentative: true, terrain: "rock" }))).toBe("🟧");
    expect(cellGlyph(base({ tentative: true, terrain: "soil" }))).toBe("🟠");
  });

  it("distinguishes eliminated by terrain", () => {
    expect(cellGlyph(base({ eliminated: true, terrain: "rock" }))).toBe("🔴");
    expect(cellGlyph(base({ eliminated: true, terrain: "soil" }))).toBe("🟥");
  });

  it("distinguishes suggested by terrain", () => {
    expect(cellGlyph(base({ suggested: true, terrain: "rock" }))).toBe("⚒️");
    expect(cellGlyph(base({ suggested: true, terrain: "soil" }))).toBe("⛏️");
  });

  it("falls through to bare terrain glyphs", () => {
    expect(cellGlyph(base({ terrain: "wall" }))).toBe("⬛");
    expect(cellGlyph(base({ terrain: "rock" }))).toBe("🪨");
    expect(cellGlyph(base({ terrain: "soil" }))).toBe("🟫");
  });
});
