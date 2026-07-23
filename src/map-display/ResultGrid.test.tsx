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
