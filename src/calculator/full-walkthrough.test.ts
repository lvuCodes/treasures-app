import { describe, it, expect } from "vitest";
import { evaluateWalkthrough } from "./walkthrough";

// The full-walkthrough suite validates the solver across a complete single-map
// play-through (the transition-states Level 10 session): at every input→recompute
// step it consumes the recorded state + remaining inventory and recommends.
// Reviewed conclusion: the solver matches or OUTPERFORMS the hand-made sheet at
// every step — where they differ, the sheet picked equal-or-lower-probability
// cells, never a cell stronger than the solver's recommendation. That dominance
// is asserted below; the sheet is reference, not an oracle.
describe("full-walkthrough (single-map play-through)", () => {
  const evals = evaluateWalkthrough();

  it("has steps to evaluate", () => {
    expect(evals.length).toBeGreaterThan(0);
  });

  it("reaches a complete state at the final step", () => {
    expect(evals[evals.length - 1].complete).toBe(true);
  });

  it("solver recommendation dominates the sheet at every step (never weaker)", () => {
    for (const e of evals) {
      expect(e.solverDominatesSheet).toBe(true);
    }
  });

  for (const e of evals) {
    describe(`step ${e.step} — ${e.label}`, () => {
      if (e.complete) {
        it("map complete: no items remain and nothing is recommended", () => {
          expect(e.remaining.length).toBe(0);
          expect(e.solverTop.length).toBe(0);
        });
        return;
      }

      it("recommends at least one cell while items remain", () => {
        expect(e.solverTop.length).toBeGreaterThan(0);
      });

      it("recommends only diggable cells (respects transitional state)", () => {
        for (const key of e.solverTop) {
          const [r, c] = key.split(",").map(Number);
          const cell = e.grid[r][c];
          expect(cell.terrain).not.toBe("wall");
          expect(cell.revealedEmpty).toBeFalsy();
          expect(cell.item).toBeFalsy();
          expect(cell.confirmed).toBeFalsy();
          expect(cell.eliminated).toBeFalsy();
        }
      });

      it("is deterministic", () => {
        const again = evaluateWalkthrough().find((x) => x.step === e.step)!;
        expect(again.solverTop).toEqual(e.solverTop);
      });
    });
  }
});
