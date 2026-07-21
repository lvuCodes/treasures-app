import { describe, it, expect } from "vitest";
import { solve, type Item } from "./solver";
import { toNumericGrid, type Cell } from "./cell-state";
import testMaps from "./fixtures/test-maps.json";
import extractedData from "./fixtures/test-data-extracted.json";

interface TestMap {
  items: Item[];
  grid: number[][];
}

interface ExtractedMap {
  items: Item[];
  grid: Cell[][];
  has_gopher: boolean;
  has_revealed: boolean;
}

describe("Recommend First Dig", () => {
  describe("core algorithm properties", () => {
    it("produces output for diggable cells", () => {
      const map = testMaps[0] as TestMap;
      const result = solve(map.grid, map.items);
      expect(result.scores.length).toBeGreaterThan(0);
    });

    it("is deterministic", () => {
      const map = testMaps[1] as TestMap;
      const r1 = solve(map.grid, map.items);
      const r2 = solve(map.grid, map.items);
      expect(r1.scores).toEqual(r2.scores);
      expect(r1.top).toEqual(r2.top);
    });

    it("never scores wall cells", () => {
      const map = testMaps[1] as TestMap;
      const result = solve(map.grid, map.items);
      for (const cell of result.scores) {
        expect(map.grid[cell.row][cell.col]).toBeGreaterThanOrEqual(1);
      }
    });

    it("completes in under 100ms for a 10x10 grid", () => {
      const grid: number[][] = Array.from({ length: 10 }, () => new Array(10).fill(1));
      const items: Item[] = [
        { count: 2, long: 3, short: 2 },
        { count: 3, long: 2, short: 1 },
        { count: 1, long: 4, short: 1 },
      ];
      const start = performance.now();
      solve(grid, items);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("rock cost weighting", () => {
    // Rock (state 2) requires two shovels and reveals nothing until both
    // land, so priority is probability per shovel: score / cell cost. Asserted
    // as a ratio so it holds regardless of the item-size weighting factor.
    it("scores a rock cell at half an equally-probable dig cell", () => {
      const grid = [
        [1, 1],
        [2, 2],
      ];
      const items: Item[] = [{ count: 1, long: 2, short: 1 }];
      const result = solve(grid, items);
      const at = (row: number, col: number) =>
        result.scores.find((s) => s.row === row && s.col === col)!;
      // Equal-probability cells in the same row score equally...
      expect(at(0, 0).score).toBeCloseTo(at(0, 1).score);
      expect(at(1, 0).score).toBeCloseTo(at(1, 1).score);
      // ...and each rock scores half the equally-probable soil cell above it.
      expect(at(1, 0).score).toBeCloseTo(at(0, 0).score / 2);
      expect(at(1, 1).score).toBeCloseTo(at(0, 1).score / 2);
    });

    it("top picks exclude rocks when raw probabilities are equal", () => {
      const grid = [
        [1, 1],
        [2, 2],
      ];
      const items: Item[] = [{ count: 1, long: 2, short: 1 }];
      const result = solve(grid, items);
      expect(result.top).toHaveLength(2);
      for (const cell of result.top) {
        expect(cell.row).toBe(0);
      }
    });

    it("a rock cell can still win when its raw probability is more than double", () => {
      // 1x3 row [1, 2, 1] with a 1x2 item: center cell appears in both
      // placements (prob 1.0), edges in one each (0.5). Cost-weighted the
      // center rock scores 0.5 and ties the edges rather than dominating.
      const grid = [[1, 2, 1]];
      const items: Item[] = [{ count: 1, long: 2, short: 1 }];
      const result = solve(grid, items);
      expect(result.top.map((c) => `${c.row},${c.col}`).sort()).toEqual(["0,0", "0,1", "0,2"]);
    });
  });

  describe("test-maps.json validation", () => {
    (testMaps as TestMap[]).forEach((map, i) => {
      it(`map ${i}: scores only diggable cells`, () => {
        const result = solve(map.grid, map.items);
        for (const cell of result.scores) {
          expect(map.grid[cell.row][cell.col]).toBeGreaterThanOrEqual(1);
        }
      });
    });
  });

  describe("extracted-map fixtures", () => {
    const fixtures = (extractedData as unknown as ExtractedMap[]).filter(
      (m) => !m.has_revealed && !m.has_gopher,
    );

    fixtures.forEach((map, i) => {
      const grid = toNumericGrid(map.grid);
      const dims = `${grid.length}x${grid[0]?.length ?? 0}`;
      const itemSig = map.items.map((it) => `${it.count}x${it.long}x${it.short}`).join("+");
      it(`fixture ${i} (${dims}, ${itemSig}): scores only diggable cells`, () => {
        const result = solve(grid, map.items);
        for (const cell of result.scores) {
          expect(grid[cell.row][cell.col]).toBeGreaterThanOrEqual(1);
        }
      });
    });
  });
});
