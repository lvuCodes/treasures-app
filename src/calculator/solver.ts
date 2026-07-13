export interface Item {
  count: number;
  long: number;
  short: number;
}

export interface CellScore {
  row: number;
  col: number;
  score: number;
}

export interface SolverResult {
  scores: CellScore[];
  top: CellScore[];
}

type Grid = number[][];

interface Orientation {
  rows: number;
  cols: number;
}

export function getOrientations(item: Item): Orientation[] {
  if (item.long === item.short) {
    return [{ rows: item.long, cols: item.short }];
  }
  return [
    { rows: item.long, cols: item.short },
    { rows: item.short, cols: item.long },
  ];
}

export function isDiggable(cell: number): boolean {
  return cell >= 1;
}

export type { Orientation };

export function solve(grid: Grid, items: Item[]): SolverResult {
  const rows = grid.length;
  const cols = grid[0].length;
  const scoreGrid: number[][] = Array.from({ length: rows }, () =>
    new Array(cols).fill(0),
  );

  // Each item instance carries its area (cell count). Larger items weight more
  // heavily so a bigger item is prioritized over several smaller ones that
  // would otherwise outvote it (size preference — "target larger items first").
  const expanded: { orientations: Orientation[]; area: number }[] = [];
  for (const item of items) {
    const orientations = getOrientations(item);
    const area = item.long * item.short;
    for (let i = 0; i < item.count; i++) {
      expanded.push({ orientations, area });
    }
  }

  for (const { orientations, area } of expanded) {
    let totalPlacements = 0;
    const cellCounts: number[][] = Array.from({ length: rows }, () =>
      new Array(cols).fill(0),
    );

    for (const { rows: h, cols: w } of orientations) {
      for (let r = 0; r <= rows - h; r++) {
        for (let c = 0; c <= cols - w; c++) {
          let valid = true;
          for (let dr = 0; dr < h && valid; dr++) {
            for (let dc = 0; dc < w && valid; dc++) {
              if (!isDiggable(grid[r + dr][c + dc])) {
                valid = false;
              }
            }
          }
          if (valid) {
            totalPlacements++;
            for (let dr = 0; dr < h; dr++) {
              for (let dc = 0; dc < w; dc++) {
                cellCounts[r + dr][c + dc]++;
              }
            }
          }
        }
      }
    }

    if (totalPlacements > 0) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          scoreGrid[r][c] += (area * cellCounts[r][c]) / totalPlacements;
        }
      }
    }
  }

  const scores: CellScore[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isDiggable(grid[r][c]) && scoreGrid[r][c] > 0) {
        // Rock (state 2) takes two shovels and reveals nothing until the
        // second lands, so rank by probability per shovel spent.
        scores.push({ row: r, col: c, score: scoreGrid[r][c] / grid[r][c] });
      }
    }
  }

  scores.sort((a, b) => b.score - a.score);

  // All cells tied for the highest probability — compared with a tolerance so a
  // genuine tie is never split by floating-point rounding.
  const topScore = scores.length > 0 ? scores[0].score : 0;
  const top = scores.filter((s) => Math.abs(s.score - topScore) < 1e-9);

  return { scores, top };
}
