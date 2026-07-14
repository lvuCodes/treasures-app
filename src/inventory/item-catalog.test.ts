import { describe, expect, it } from "vitest";
import { ITEM_COLOR_COUNT, ITEM_TYPES, KEYCAPS, itemColor } from "./item-catalog";

describe("ITEM_TYPES", () => {
  it("lists the eight supported shapes with long ≥ short", () => {
    expect(ITEM_TYPES).toHaveLength(8);
    expect(ITEM_TYPES.every((t) => t.long >= t.short)).toBe(true);
  });
});

describe("itemColor", () => {
  it("maps item 1 to the first hue and item ITEM_COLOR_COUNT to the last", () => {
    expect(itemColor(1)).toBe("var(--item-1)");
    expect(itemColor(ITEM_COLOR_COUNT)).toBe(`var(--item-${ITEM_COLOR_COUNT})`);
  });

  it("wraps past ITEM_COLOR_COUNT back to the first hue", () => {
    expect(itemColor(ITEM_COLOR_COUNT + 1)).toBe(itemColor(1));
    expect(itemColor(ITEM_COLOR_COUNT + 2)).toBe(itemColor(2));
  });
});

describe("KEYCAPS", () => {
  it("covers all ten item slots", () => {
    expect(KEYCAPS).toHaveLength(ITEM_COLOR_COUNT);
  });
});
