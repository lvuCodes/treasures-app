// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMapPaint } from "./useMapPaint";
import type { MouseEvent } from "react";

// A minimal mouse-event stub carrying only what the hook reads.
const mouse = (over: Partial<MouseEvent> = {}) =>
  ({ preventDefault: () => {}, clientX: 0, clientY: 0, ...over }) as MouseEvent;

// Drive the hook over a mutable grid, re-rendering with the latest value after
// each setGrid so the ref-based base snapshot sees fresh data.
function setup(initial: number[][], locked = false) {
  let grid = initial;
  const setGrid = (u: number[][] | ((g: number[][]) => number[][])) => {
    grid = typeof u === "function" ? (u as (g: number[][]) => number[][])(grid) : u;
  };
  const hook = renderHook(({ g }) => useMapPaint({ grid: g, setGrid, locked }), {
    initialProps: { g: grid },
  });
  const rerender = () => hook.rerender({ g: grid });
  return { hook, rerender, getGrid: () => grid };
}

const grid3 = () => [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

describe("useMapPaint", () => {
  it("cycles a single cell wall→soil→rock→wall on a plain click", () => {
    const { hook, getGrid } = setup(grid3());
    act(() => hook.result.current.cellClick(1, 1));
    expect(getGrid()[1][1]).toBe(1);
    act(() => hook.result.current.cellClick(1, 1));
    expect(getGrid()[1][1]).toBe(2);
    act(() => hook.result.current.cellClick(1, 1));
    expect(getGrid()[1][1]).toBe(0);
  });

  it("does nothing while locked", () => {
    const { hook, getGrid } = setup(grid3(), true);
    act(() => {
      hook.result.current.paintDown(mouse(), 0, 0);
      hook.result.current.cellClick(0, 0);
    });
    expect(getGrid()).toEqual(grid3());
    expect(hook.result.current.dragSize).toBeNull();
  });

  it("fills a rectangle on drag and exposes a live size readout", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(mouse(), 0, 0));
    rerender();
    act(() => hook.result.current.paintEnter(mouse({ clientX: 5, clientY: 5 }), 2, 2));
    rerender();

    // Whole 3×3 filled with the start cell's next state (0→1).
    expect(getGrid()).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(hook.result.current.dragSize).toMatchObject({ w: 3, h: 3, x: 5, y: 5 });
  });

  it("suppresses the click-cycle that ends a drag", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(mouse(), 0, 0));
    rerender();
    act(() => hook.result.current.paintEnter(mouse(), 1, 0));
    rerender();
    const afterDrag = getGrid().map((r) => [...r]);

    act(() => hook.result.current.cellClick(0, 0)); // ends the drag, must not cycle
    expect(getGrid()).toEqual(afterDrag);
  });

  it("clears the drag readout on window mouseup", () => {
    const { hook, rerender } = setup(grid3());
    act(() => hook.result.current.paintDown(mouse(), 0, 0));
    rerender();
    act(() => hook.result.current.paintEnter(mouse({ clientX: 3 }), 0, 2));
    rerender();
    expect(hook.result.current.dragSize).not.toBeNull();

    act(() => window.dispatchEvent(new Event("mouseup")));
    expect(hook.result.current.dragSize).toBeNull();
  });
});
