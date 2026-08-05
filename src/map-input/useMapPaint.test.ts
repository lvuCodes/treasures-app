// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMapPaint } from "./useMapPaint";
import type { PointerEvent } from "react";

// A minimal pointer-event stub carrying only what the hook reads. `setPointerCapture`
// is a no-op so the down handler works without a real captured element.
const ptr = (over: Partial<PointerEvent> = {}) =>
  ({
    preventDefault: () => {},
    pointerId: 1,
    clientX: 0,
    clientY: 0,
    buttons: 1,
    button: 0,
    currentTarget: { setPointerCapture: () => {} },
    ...over,
  }) as unknown as PointerEvent;

// paintMove resolves the cell under the pointer via document.elementFromPoint;
// point it at a cell carrying the data-r/data-c the grid renders.
// jsdom has no layout engine, so elementFromPoint isn't implemented; stub it.
function pointAt(r: number, c: number) {
  const el = document.createElement("button");
  el.dataset.r = String(r);
  el.dataset.c = String(c);
  document.elementFromPoint = () => el;
}

afterEach(() => {
  vi.restoreAllMocks();
});

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
      hook.result.current.paintDown(ptr(), 0, 0);
      hook.result.current.cellClick(0, 0);
    });
    expect(getGrid()).toEqual(grid3());
    expect(hook.result.current.dragSize).toBeNull();
  });

  it("fills a rectangle on a mouse drag and exposes a live size readout", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 0, 0));
    rerender();
    pointAt(2, 2);
    act(() => hook.result.current.paintMove(ptr({ clientX: 5, clientY: 5 })));
    rerender();

    // Whole 3×3 filled with the start cell's next state (0→1).
    expect(getGrid()).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(hook.result.current.dragSize).toMatchObject({ w: 3, h: 3, x: 5, y: 5 });
  });

  it("paints the identical rectangle across a touch drag, stepping to the next state", () => {
    // A touch drag is the same pointer path: down on the start cell, move across
    // the region resolving each cell under the finger, then release off-window.
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr({ pointerId: 7, clientX: 1, clientY: 1 }), 0, 0));
    rerender();

    // Finger travels 0,0 → 1,1 → 2,2; the rectangle re-fills from the clean base
    // each step, so it's always a rectangle, not a trail.
    pointAt(1, 1);
    act(() => hook.result.current.paintMove(ptr({ pointerId: 7, clientX: 4, clientY: 4 })));
    rerender();
    pointAt(2, 2);
    act(() => hook.result.current.paintMove(ptr({ pointerId: 7, clientX: 8, clientY: 8 })));
    rerender();

    expect(getGrid()).toEqual([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(hook.result.current.dragSize).toMatchObject({ w: 3, h: 3, x: 8, y: 8 });

    // Finger lifts anywhere (touch has no hover) — the window pointerup ends it.
    act(() => window.dispatchEvent(new Event("pointerup")));
    expect(hook.result.current.dragSize).toBeNull();
  });

  it("suppresses the click-cycle that ends a drag", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 0, 0));
    rerender();
    pointAt(1, 0);
    act(() => hook.result.current.paintMove(ptr()));
    rerender();
    const afterDrag = getGrid().map((r) => [...r]);

    act(() => hook.result.current.cellClick(0, 0)); // ends the drag, must not cycle
    expect(getGrid()).toEqual(afterDrag);
  });

  it("cycles the cell on pointer release, then swallows the trailing click", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 1, 1));
    rerender();
    act(() => hook.result.current.paintUp(ptr()));
    rerender();
    expect(getGrid()[1][1]).toBe(1);

    act(() => hook.result.current.cellClick(1, 1)); // the click that trails the tap
    expect(getGrid()[1][1]).toBe(1);
  });

  it("cycles the pointer-down cell even when the click is retargeted elsewhere", () => {
    // The mobile-Safari symptom: two rapid taps, and the browser dispatches the
    // second click against the FIRST cell. The release already committed the
    // correct cell, and the retargeted click is swallowed.
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 0, 0));
    rerender();
    act(() => hook.result.current.paintUp(ptr()));
    rerender();
    act(() => hook.result.current.paintDown(ptr(), 0, 1));
    rerender();
    act(() => hook.result.current.paintUp(ptr()));
    rerender();
    act(() => hook.result.current.cellClick(0, 0)); // Safari's stale-target click
    rerender();

    expect(getGrid()[0][0]).toBe(1);
    expect(getGrid()[0][1]).toBe(1);
  });

  it("still cycles on a click with no pointer sequence (keyboard activation)", () => {
    const { hook, getGrid } = setup(grid3());
    act(() => hook.result.current.cellClick(2, 2));
    expect(getGrid()[2][2]).toBe(1);
  });

  it("does not cycle when a drag ends on release", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 0, 0));
    rerender();
    pointAt(0, 1);
    act(() => hook.result.current.paintMove(ptr()));
    rerender();
    const afterDrag = getGrid().map((row) => [...row]);

    act(() => hook.result.current.paintUp(ptr()));
    rerender();
    expect(getGrid()).toEqual(afterDrag);
  });

  it("does not cycle on a non-primary button release", () => {
    const { hook, rerender, getGrid } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 1, 1));
    rerender();
    act(() => hook.result.current.paintUp(ptr({ button: 2 })));
    rerender();
    expect(getGrid()).toEqual(grid3());
  });

  it("clears the drag readout on window pointerup", () => {
    const { hook, rerender } = setup(grid3());
    act(() => hook.result.current.paintDown(ptr(), 0, 0));
    rerender();
    pointAt(0, 2);
    act(() => hook.result.current.paintMove(ptr({ clientX: 3 })));
    rerender();
    expect(hook.result.current.dragSize).not.toBeNull();

    act(() => window.dispatchEvent(new Event("pointerup")));
    expect(hook.result.current.dragSize).toBeNull();
  });
});
