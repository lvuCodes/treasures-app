import { describe, it, expect } from "vitest";
import { deriveEliminations, deriveForced, isSolvable } from "./elimination";
import { deriveConfirmedState } from "./footprint";
import { toNumericGrid, type Cell } from "./cell-state";
import { walkthrough } from "./walkthrough";
import type { Item } from "./solver";

const key = (c: { row: number; col: number }) => `${c.row},${c.col}`;
const sortKeys = (cs: { row: number; col: number }[]) => cs.map(key).sort();

describe("solvability (overlap / unsolvable detection)", () => {
  it("a single item that fits is solvable", () => {
    expect(isSolvable([[1, 1], [1, 1]], [{ count: 1, long: 2, short: 2 }])).toBe(true);
  });

  it("items that cannot all fit without overlap are unsolvable", () => {
    // 1x3 has only two overlapping 2x1 placements — two items can't both fit.
    expect(isSolvable([[1, 1, 1]], [{ count: 2, long: 2, short: 1 }])).toBe(false);
  });

  it("an item with no valid placement is unsolvable", () => {
    expect(isSolvable([[1, 0], [0, 1]], [{ count: 1, long: 2, short: 1 }])).toBe(false);
  });

  it("no remaining items is trivially solvable", () => {
    expect(isSolvable([[1, 1]], [])).toBe(true);
  });
});

describe("elimination derivation", () => {
  it("eliminates cells no placement can reach", () => {
    // Diagonal soil with walls between: a 2x1 fits nowhere.
    const elim = deriveEliminations([[1, 0], [0, 1]], [{ count: 1, long: 2, short: 1 }]);
    expect(sortKeys(elim)).toEqual(["0,0", "1,1"].sort());
  });

  it("eliminates nothing when every diggable cell is reachable", () => {
    const elim = deriveEliminations([[1, 1], [1, 1]], [{ count: 1, long: 2, short: 2 }]);
    expect(elim).toEqual([]);
  });

  // Joint reasoning: a cell live in isolation can still be dead once the other
  // items must also be placed. Validated against the walkthrough's recorded
  // eliminations — exact at suggestion steps, superset at input steps (the
  // derivation runs a step ahead of the sheet, as footprint inference does).
  describe("reproduces the sheet's eliminations", () => {
    const dims = new Map<number, { long: number; short: number }>();
    let n = 0;
    for (const it of walkthrough.items) {
      for (let k = 0; k < it.count; k++) {
        n += 1;
        dims.set(n, { long: it.long, short: it.short });
      }
    }

    for (const step of walkthrough.steps) {
      const sheet = sortKeys(
        step.grid.flatMap((row, r) =>
          row.flatMap((c, col) => (c.eliminated ? [{ row: r, col: col }] : [])),
        ),
      );
      if (!sheet.length) continue;

      it(`step ${step.step}`, () => {
        // Strip eliminations so the derivation must reproduce them.
        const stripped: Cell[][] = step.grid.map((row) =>
          row.map((c) => ({ ...c, eliminated: false })),
        );
        const { grid, located } = deriveConfirmedState(stripped, dims);
        const remaining: Item[] = [...dims.keys()]
          .filter((i) => !located.has(i))
          .map((i) => ({ count: 1, ...dims.get(i)! }));
        const derived = sortKeys(deriveEliminations(toNumericGrid(grid), remaining));

        // Derivation must cover everything the sheet eliminated...
        expect(sheet.filter((k) => !derived.includes(k))).toEqual([]);
        // ...and match exactly once the sheet has caught up (suggestion steps).
        if (step.kind === "suggestion") expect(derived).toEqual(sheet);
      });
    }
  });
});

describe("deriveForced (guaranteed item cells)", () => {
  // Capture 154256 state: a 1×3 is located at col 3 rows 4–6 (those cells +
  // recorded part are blocked), 5,2 is dug empty, remaining are 1×1/1×2/1×4.
  // The 1×4 can only fit the right column (col 5, rows 3–6) → all four forced.
  // In the left block 3,2 is also forced: 3,3 and 4,2 can each only pair with
  // 3,2 for the 1×2, so every arrangement covers it. 6,2 stays optional (it can
  // be left empty when the 1×1 takes 3,3 or 4,2).
  it("forces the only 1×4 column plus a deduced left-block cell", () => {
    const g = Array.from({ length: 10 }, () => Array(10).fill(0));
    // left block (col 2/3) live cells, with the located 1×3 col-3 r4-6 blocked
    g[3][2] = 1; g[3][3] = 1;
    g[4][2] = 2; /* 4,3 blocked */
    /* 5,2 dug empty (0), 5,3 blocked */
    g[6][2] = 1; /* 6,3 blocked */
    // right column (the only 1×4 slot)
    g[3][5] = 2; g[4][5] = 1; g[5][5] = 2; g[6][5] = 1;
    const remaining: Item[] = [
      { count: 1, long: 1, short: 1 },
      { count: 1, long: 2, short: 1 },
      { count: 1, long: 4, short: 1 },
    ];
    const forced = sortKeys(deriveForced(g, remaining));
    expect(forced).toEqual(["3,2", "3,5", "4,5", "5,5", "6,5"]);
    expect(forced).not.toContain("6,2"); // optional cell stays unforced
  });

  it("returns nothing when items can be arranged many ways", () => {
    const g = Array.from({ length: 10 }, () => Array(10).fill(1)); // open board
    const forced = deriveForced(g, [{ count: 1, long: 1, short: 1 }]);
    expect(forced).toEqual([]);
  });
});
