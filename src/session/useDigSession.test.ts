// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDigSession } from "./useDigSession";
import type { ItemDims } from "../calculator/session";

interface Item extends ItemDims {
  label: string;
}

const ITEM_TYPES: Item[] = [
  { long: 1, short: 1, label: "coin" },
  { long: 2, short: 1, label: "bar" },
];

// A 5×5 soil board — plenty of room for the tiny fixtures.
const soil = (): number[][] => Array.from({ length: 5 }, () => new Array<number>(5).fill(1));

function setup(onCalculate?: (g: number[][]) => void) {
  return renderHook(() =>
    useDigSession<Item>({ grid: soil(), itemTypes: ITEM_TYPES, onCalculate }),
  );
}

describe("useDigSession", () => {
  it("starts empty and locked=false", () => {
    const { result } = setup();
    expect(result.current.total).toBe(0);
    expect(result.current.locked).toBe(false);
    expect(result.current.inputMode).toBe(true);
    expect(result.current.expandedItems).toEqual([]);
  });

  it("expands items by their counts", () => {
    const { result } = setup();
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.changeCount(1, 1));
    expect(result.current.total).toBe(2);
    expect(result.current.expandedItems).toHaveLength(2);
  });

  it("errors on submit with no items and does not call the calculate seam", () => {
    const onCalculate = vi.fn();
    const { result } = setup(onCalculate);
    act(() => result.current.submit());
    expect(result.current.error).toBe("Add at least one item (count > 0).");
    expect(onCalculate).not.toHaveBeenCalled();
  });

  it("runs the calculate seam and locks on a valid submit", () => {
    const onCalculate = vi.fn();
    const { result } = setup(onCalculate);
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.submit());
    expect(onCalculate).toHaveBeenCalledOnce();
    expect(result.current.locked).toBe(true);
    expect(result.current.result).not.toBeNull();
  });

  it("records a cell into foundSet and clears it again", () => {
    const { result } = setup();
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.recordCell(0, 0, 1));
    expect(result.current.foundSet.has(1)).toBe(true);

    act(() => result.current.clearCell(0, 0));
    expect(result.current.foundSet.has(1)).toBe(false);
  });

  it("undoes the last commit", () => {
    const { result } = setup();
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.recordCell(0, 0, 1));
    expect(result.current.foundSet.has(1)).toBe(true);
    act(() => result.current.undo());
    expect(result.current.foundSet.has(1)).toBe(false);
  });

  it("clears counts back to zero", () => {
    const { result } = setup();
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.changeCount(1, 1));
    act(() => result.current.clearCounts());
    expect(result.current.total).toBe(0);
  });

  it("returns to input on newSession after a solve", () => {
    const { result } = setup();
    act(() => result.current.changeCount(0, 1));
    act(() => result.current.submit());
    expect(result.current.locked).toBe(true);
    act(() => result.current.newSession());
    expect(result.current.locked).toBe(false);
    expect(result.current.total).toBe(0);
  });
});
