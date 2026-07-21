import { describe, it, expect } from "vitest";
import {
  inferFootprint,
  inferFootprints,
  itemFootprints,
  deriveConfirmedState,
  partGlyphForFootprint,
} from "./footprint";
import { walkthrough } from "./walkthrough";
import type { Cell } from "./cell-state";

const anyFit = () => true;
const key = (c: { row: number; col: number }) => `${c.row},${c.col}`;
const sortKeys = (cells: { row: number; col: number }[]) => cells.map(key).sort();

// A grid of plain soil; tests then drop item parts onto specific cells.
const soilGrid = (rows: number, cols: number): Cell[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ terrain: "soil", hitsRemaining: 1 }) as Cell),
  );

const flagged = (grid: Cell[][], flag: "confirmed" | "tentative") =>
  sortKeys(
    grid.flatMap((row, r) => row.flatMap((cell, c) => (cell[flag] ? [{ row: r, col: c }] : []))),
  );

describe("footprint inference", () => {
  describe("glyph → footprint", () => {
    it("1x1 is its own footprint", () => {
      expect(inferFootprint(undefined, 2, 3, 1, 1, anyFit)).toEqual([{ row: 2, col: 3 }]);
    });

    it("╣ right-middle of a 3x2 spans the 3-tall column pair", () => {
      const fp = inferFootprint("╣", 4, 1, 3, 2, anyFit)!;
      expect(sortKeys(fp)).toEqual(["3,0", "3,1", "4,0", "4,1", "5,0", "5,1"].sort());
    });

    it("╝ bottom-right of a 3x2 spans up-and-left", () => {
      const fp = inferFootprint("╝", 2, 3, 3, 2, anyFit)!;
      expect(sortKeys(fp)).toEqual(["0,2", "0,3", "1,2", "1,3", "2,2", "2,3"].sort());
    });

    it("↕ vertical middle of a 3x1 spans the 3-tall column", () => {
      const fp = inferFootprint("↕", 4, 5, 3, 1, anyFit)!;
      expect(sortKeys(fp)).toEqual(["3,5", "4,5", "5,5"].sort());
    });

    it("↔ horizontal middle of a 3x1 spans the 3-wide row", () => {
      const fp = inferFootprint("↔", 5, 3, 3, 1, anyFit)!;
      expect(sortKeys(fp)).toEqual(["5,2", "5,3", "5,4"].sort());
    });

    it("➡️ end cap places the body to the left", () => {
      const fp = inferFootprint("➡️", 0, 3, 3, 1, anyFit)!;
      expect(sortKeys(fp)).toEqual(["0,1", "0,2", "0,3"].sort());
    });

    it("rejects an orientation that does not fit", () => {
      const fitsTopLeftOnly = (cells: { row: number; col: number }[]) =>
        cells.every((c) => c.row >= 0 && c.col >= 0);
      // ╝ bottom-right at (1,1) for a 3x2 would need rows -1.. → out of bounds.
      expect(inferFootprint("╝", 1, 1, 3, 2, fitsTopLeftOnly)).toBeNull();
    });
  });

  // The strongest check: rederiving footprints from the recorded parts must
  // reproduce the confirmed cells the sheet itself painted. Inference runs as
  // soon as a part is recorded, so on input steps it may be a step ahead of the
  // sheet (which paints at the next suggestion) — there we assert a superset,
  // and require exact equality once the sheet has caught up (suggestion steps).
  describe("reproduces the sheet's confirmed cells", () => {
    const dims = new Map<number, { long: number; short: number }>();
    let n = 0;
    for (const it of walkthrough.items) {
      for (let k = 0; k < it.count; k++) {
        n += 1;
        dims.set(n, { long: it.long, short: it.short });
      }
    }

    for (const step of walkthrough.steps) {
      const sheetConfirmed = sortKeys(
        step.grid.flatMap((row, r) =>
          row.flatMap((cell, c) => (cell.confirmed ? [{ row: r, col: c }] : [])),
        ),
      );
      if (!sheetConfirmed.length) continue;

      it(`step ${step.step}`, () => {
        // Strip the sheet's confirmed flags, then rederive from parts only.
        const stripped: Cell[][] = step.grid.map((row) =>
          row.map((cell) => ({ ...cell, confirmed: false })),
        );
        const { grid } = deriveConfirmedState(stripped, dims);
        const derived = sortKeys(
          grid.flatMap((row, r) =>
            row.flatMap((cell, c) => (cell.confirmed ? [{ row: r, col: c }] : [])),
          ),
        );
        // Inference must cover everything the sheet confirmed...
        expect(sheetConfirmed.filter((k) => !derived.includes(k))).toEqual([]);
        // ...and match exactly once the sheet has caught up.
        if (step.kind === "suggestion") expect(derived).toEqual(sheetConfirmed);
      });
    }
  });
});

// A length-4 item recorded only at an internal cell can't be placed precisely —
// the slot is ambiguous. inferFootprints fans the ambiguity out into candidates;
// deriveConfirmedState reduces those to a confident core (in every candidate)
// and tentative edges (in some). Mirrors the design diagram for 1×4 / 2×4.
describe("ambiguous (length-4) internal finds", () => {
  describe("candidate enumeration", () => {
    it("1×4 internal (↔️) yields the two possible placements", () => {
      const cands = inferFootprints("↔️", 0, 2, 4, 1, anyFit);
      expect(cands.map(sortKeys).sort()).toEqual(
        [
          ["0,0", "0,1", "0,2", "0,3"],
          ["0,1", "0,2", "0,3", "0,4"],
        ].sort(),
      );
    });

    it("1×3 internal (↔️) has a true centre — one placement", () => {
      expect(inferFootprints("↔️", 0, 2, 3, 1, anyFit)).toHaveLength(1);
    });

    it("1×2 has no internal cell — ↔️ is infeasible", () => {
      expect(inferFootprints("↔️", 0, 2, 2, 1, anyFit)).toHaveLength(0);
    });

    it("2×4 top-edge internal (╦) keeps the known edge, only the slot is ambiguous", () => {
      const cands = inferFootprints("╦", 0, 2, 4, 2, anyFit);
      // Both candidates occupy rows 0–1 (the pinned top edge); columns shift.
      expect(cands.map(sortKeys).sort()).toEqual(
        [
          ["0,0", "0,1", "0,2", "0,3", "1,0", "1,1", "1,2", "1,3"],
          ["0,1", "0,2", "0,3", "0,4", "1,1", "1,2", "1,3", "1,4"],
        ].sort(),
      );
    });
  });

  describe("confidence overlay (deriveConfirmedState)", () => {
    const dims = new Map([[1, { long: 4, short: 1 }]]);

    it("one internal find → confident core, tentative edges, not located", () => {
      const grid = soilGrid(1, 6);
      grid[0][2].item = { index: 1, part: "↔️" };
      const { grid: out, located } = deriveConfirmedState(grid, dims);
      expect(flagged(out, "confirmed")).toEqual(["0,1", "0,3"]); // in both candidates
      expect(flagged(out, "tentative")).toEqual(["0,0", "0,4"]); // each in only one
      expect(located.has(1)).toBe(false);
    });

    it("a second internal piece pins it (AaaAxx) → located, no tentative", () => {
      const grid = soilGrid(1, 6);
      grid[0][1].item = { index: 1, part: "↔️" };
      grid[0][2].item = { index: 1, part: "↔️" };
      const { grid: out, located } = deriveConfirmedState(grid, dims);
      expect(flagged(out, "confirmed")).toEqual(["0,0", "0,3"]); // end-caps
      expect(flagged(out, "tentative")).toEqual([]);
      expect(located.has(1)).toBe(true);
      // located item's confirmed footprint cells are tagged with its index
      expect(out[0][0].confirmedItem).toBe(1);
      expect(out[0][3].confirmedItem).toBe(1);
    });

    it("tags confirmedItem on an unlocated item's confident core too", () => {
      const grid = soilGrid(1, 6);
      grid[0][2].item = { index: 1, part: "↔️" }; // single internal → ambiguous
      const { grid: out, located } = deriveConfirmedState(grid, dims);
      expect(out[0][1].confirmed).toBe(true);
      expect(out[0][1].confirmedItem).toBe(1); // certainly item 1, even unlocated
      expect(located.has(1)).toBe(false);
    });

    it("an end-cap piece resolves the other way (xAabbx) → located", () => {
      const grid = soilGrid(1, 6);
      grid[0][1].item = { index: 1, part: "⬅️" }; // end cap, body extends right
      grid[0][2].item = { index: 1, part: "↔️" };
      const { grid: out, located } = deriveConfirmedState(grid, dims);
      expect(flagged(out, "confirmed")).toEqual(["0,3", "0,4"]);
      expect(flagged(out, "tentative")).toEqual([]);
      expect(located.has(1)).toBe(true);
    });
  });

  describe("candidate intersection (itemFootprints)", () => {
    it("two consistent internal parts collapse to a single footprint", () => {
      const cands = itemFootprints(
        [
          { row: 0, col: 1, glyph: "↔️" },
          { row: 0, col: 2, glyph: "↔️" },
        ],
        4,
        1,
        anyFit,
      );
      expect(cands.map(sortKeys)).toEqual([["0,0", "0,1", "0,2", "0,3"]]);
    });
  });

  // The forward glyph table (partGlyphForFootprint) and the inverse table
  // (inferFootprints) are two encodings of one glyph alphabet. Assert they agree
  // end-to-end so they can't silently drift: label every cell of a placement,
  // then infer footprints back from each glyph and confirm the original
  // placement is among the candidates. (DRY: two must-match outputs, one test.)
  describe("glyph forward/inverse round-trip", () => {
    // Every occupied cell of the h×w rectangle anchored at (r0,c0), as "r,c".
    const rect = (r0: number, c0: number, h: number, w: number) => {
      const keys: string[] = [];
      for (let dr = 0; dr < h; dr++)
        for (let dc = 0; dc < w; dc++) keys.push(`${r0 + dr},${c0 + dc}`);
      return keys;
    };

    // (long, short, height, width) placements covering lines, boxes, and the
    // length-4 line whose interior cells are the ambiguous "mid" case.
    const cases: [number, number, number, number][] = [
      [2, 1, 1, 2], // 1×2 horizontal
      [2, 1, 2, 1], // 1×2 vertical
      [3, 1, 1, 3], // 1×3 horizontal (has a mid)
      [4, 1, 1, 4], // 1×4 horizontal (mid is ambiguous)
      [2, 2, 2, 2], // 2×2 box
      [3, 2, 2, 3], // 2×3 box
      [3, 3, 3, 3], // 3×3 box
    ];

    for (const [long, short, h, w] of cases) {
      it(`labels and re-infers a ${long}×${short} (${h}×${w}) placement`, () => {
        const cellKeys = rect(2, 2, h, w).sort();
        for (const k of cellKeys) {
          const [r, c] = k.split(",").map(Number);
          const glyph = partGlyphForFootprint(r, c, cellKeys, long, short);
          const candidates = inferFootprints(glyph, r, c, long, short, anyFit).map((fp) =>
            sortKeys(fp).join("|"),
          );
          // The original placement must be one of the glyph's candidate footprints.
          expect(candidates).toContain(cellKeys.join("|"));
        }
      });
    }
  });
});
