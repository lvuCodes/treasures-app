// @vitest-environment jsdom
//
// The 0/red cells recede like a disabled button (issue #17): revealed-empty
// 0-cells and eliminated red cells stay clickable but carry the `empty`/
// `eliminated` state classes the stylesheet fades, and the grid gains a
// `solved` modifier once the puzzle is solved so those cells fade further.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResultGrid } from "./ResultGrid";
import type { Evaluation } from "../calculator/session";
import type { Cell } from "../calculator/cell-state";
import { emptyGrid } from "../grid";

afterEach(cleanup);

const soil = (over: Partial<Cell> = {}): Cell => ({ terrain: "soil", hitsRemaining: 1, ...over });

// A 1×2 soil strip: 0,0 dug empty (a "0 square"); 0,1 eliminated (a "red square").
function twoSoilCells() {
  const grid = emptyGrid();
  grid[0][0] = 1;
  grid[0][1] = 1;
  const confirmed = emptyGrid().map((row) => row.map(() => soil()));
  confirmed[0][0] = soil({ hitsRemaining: 0, revealedEmpty: true });
  return { grid, confirmed };
}

function baseResult(over: Partial<Evaluation> = {}): Evaluation {
  return {
    kind: "ok",
    top: new Set(),
    eliminated: new Set(["0,1"]),
    forced: new Set(),
    forcedItem: new Map(),
    solved: false,
    confirmed: twoSoilCells().confirmed,
    located: new Set(),
    hammersRemaining: 0,
    ...over,
  };
}

function renderGrid(over: Partial<Evaluation> = {}, onCellClick = vi.fn()) {
  return render(
    <ResultGrid
      grid={twoSoilCells().grid}
      result={baseResult(over)}
      dug={new Map([["0,0", 0]])}
      overlay={new Map()}
      onCellClick={onCellClick}
      onCellContextMenu={vi.fn()}
    />,
  );
}

// Cells are <button>s labelled by their "r,c" key.
const byKey = (r: number, c: number) => screen.getByRole("button", { name: `${r},${c}` });
const grid = () => screen.getByRole("grid");

describe("ResultGrid non-goal cell styling (issue #17)", () => {
  it("marks the 0-cell and red cell with their fade state classes", () => {
    renderGrid();
    expect(byKey(0, 0).className).toContain("empty");
    expect(byKey(0, 1).className).toContain("eliminated");
  });

  it("keeps the 0/red cells clickable — plain buttons, not disabled", () => {
    const onCellClick = vi.fn();
    renderGrid({}, onCellClick);
    const red = byKey(0, 1) as HTMLButtonElement;
    expect(red.disabled).toBe(false);
    fireEvent.click(red);
    expect(onCellClick).toHaveBeenCalled();
  });

  it("does not mark the grid solved while still searching", () => {
    renderGrid({ solved: false });
    expect(grid().className).not.toContain("solved");
  });

  it("marks the grid solved once every occupancy is determined", () => {
    renderGrid({ solved: true });
    expect(grid().className).toContain("solved");
  });

  it("marks the grid solved when viewing a fully located (complete) map", () => {
    renderGrid({ kind: "complete", solved: false, eliminated: new Set() });
    expect(grid().className).toContain("solved");
  });
});

// Mobile Safari coalesces two rapid taps into a double-tap gesture and dispatches
// the second `click` against the FIRST tap's target, so a click-driven board
// landed the hit on the previously-tapped cell (issue #18).
describe("ResultGrid rapid-tap handling (issue #18)", () => {
  const tap = (el: HTMLElement) => {
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
  };

  it("acts on pointer release and swallows the click that trails it", () => {
    const onCellClick = vi.fn();
    renderGrid({}, onCellClick);
    const cell = byKey(0, 1);
    tap(cell);
    expect(onCellClick).toHaveBeenCalledTimes(1);
    expect(onCellClick.mock.calls[0].slice(1)).toEqual([0, 1]);

    fireEvent.click(cell); // the browser's trailing click
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it("hits the released cell, not the one a retargeted click names", () => {
    const onCellClick = vi.fn();
    renderGrid({}, onCellClick);
    tap(byKey(0, 0));
    tap(byKey(0, 1));
    fireEvent.click(byKey(0, 0)); // Safari's stale-target click

    expect(onCellClick).toHaveBeenCalledTimes(2);
    expect(onCellClick.mock.calls.map((call) => call.slice(1))).toEqual([
      [0, 0],
      [0, 1],
    ]);
  });

  it("still fires on a click with no pointer sequence (keyboard activation)", () => {
    const onCellClick = vi.fn();
    renderGrid({}, onCellClick);
    fireEvent.click(byKey(0, 1));
    expect(onCellClick).toHaveBeenCalledTimes(1);
  });

  it("ignores a non-primary release so a right-click only opens the recorder", () => {
    const onCellClick = vi.fn();
    renderGrid({}, onCellClick);
    fireEvent.pointerDown(byKey(0, 1), { pointerId: 1, button: 2 });
    fireEvent.pointerUp(byKey(0, 1), { pointerId: 1, button: 2 });
    expect(onCellClick).not.toHaveBeenCalled();
  });
});

describe("ResultGrid hit-twice badge (#16)", () => {
  it("marks a recommended rock with a ×2 badge", () => {
    const g = emptyGrid();
    g[0][0] = 2;
    render(
      <ResultGrid
        grid={g}
        result={baseResult({ top: new Set(["0,0"]), eliminated: new Set() })}
        dug={new Map()}
        overlay={new Map()}
        onCellClick={vi.fn()}
        onCellContextMenu={vi.fn()}
      />,
    );
    expect(byKey(0, 0).querySelector(".hit-twice")?.textContent).toBe("×2");
  });

  it("leaves a recommended soil cell without the badge", () => {
    renderGrid({ top: new Set(["0,1"]), eliminated: new Set() });
    expect(byKey(0, 1).querySelector(".hit-twice")).toBeNull();
  });
});
