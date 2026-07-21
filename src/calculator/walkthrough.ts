import { solve, type Item } from "./solver";
import { toNumericGrid, type Cell } from "./cell-state";
import { deriveConfirmedState } from "./footprint";
import walkthroughData from "./fixtures/full-walkthrough-extracted.json";

interface InventoryEntry {
  item: number;
  dims: string;
  found: boolean;
}

export interface WalkthroughStep {
  step: number;
  kind: "input" | "suggestion";
  label: string;
  note: string | null;
  inventory: InventoryEntry[];
  grid: Cell[][];
}

export interface Walkthrough {
  suite: string;
  source_sheet: string;
  items: Item[];
  steps: WalkthroughStep[];
}

// Item dimensions keyed by 1-based item index, expanded from the item list
// (item 1 = first instance, etc.) — the same indices the grid parts carry.
function indexedDims(items: Item[]): Map<number, { long: number; short: number }> {
  const map = new Map<number, { long: number; short: number }>();
  let n = 0;
  for (const it of items) {
    for (let k = 0; k < it.count; k++) {
      n += 1;
      map.set(n, { long: it.long, short: it.short });
    }
  }
  return map;
}

function cellsWhere(grid: Cell[][], pred: (c: Cell) => boolean): string[] {
  const out: string[] = [];
  grid.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (pred(cell)) out.push(`${r},${c}`);
    }),
  );
  return out;
}

export interface StepEvaluation {
  /** The input step number (the user action that opens this combined step). */
  step: number;
  /** The folded suggestion step number, or null for a no-new-map input. */
  suggestionStep: number | null;
  label: string;
  note: string | null;
  remaining: Item[];
  /** Item indices located by footprint inference (⊇ all found items). */
  located: number[];
  /** Raw recorded state as the user entered it — the new part's footprint is
   *  NOT yet inferred (LEFT of the step). */
  inputGrid: Cell[][];
  /** Recompute: the input state with inferred confirmed (🟩) footprint cells
   *  (RIGHT of the step). */
  grid: Cell[][];
  /** Solver's recommended hits ("r,c") on the recompute — its top cells. */
  solverTop: string[];
  /** Cells the folded suggestion step recorded as the sheet's digs ([] if none). */
  recorded: string[];
  /** Recorded digs the solver also ranks top. */
  shared: string[];
  /** Recorded digs the solver ranks below its recommendation — equal-or-lower
   *  probability alternatives, not errors (the solver outperforms the sheet). */
  sheetOnly: string[];
  /** The solver's top probability is ≥ every recorded dig's probability: the
   *  solver never ranks a sheet pick above its own recommendation. */
  solverDominatesSheet: boolean;
  /** Whether a sheet suggestion is available to compare against. */
  hasSuggestion: boolean;
  /** True once no items remain — the map is complete. */
  complete: boolean;
}

// Evaluate the play-through as a sequence of input→recompute steps. An input
// that triggers a new map is combined with its suggestion: the input grid is
// the raw recorded state (LEFT); the recompute infers the new footprint and
// runs the solver (RIGHT), compared against the folded suggestion's digs.
// Inputs that trigger no new map stand alone. Remaining items = every item not
// located by inference (which already covers all found items).
export function evaluateWalkthrough(
  data: Walkthrough = walkthroughData as unknown as Walkthrough,
): StepEvaluation[] {
  const dims = indexedDims(data.items);
  const allIdx = [...dims.keys()];
  const out: StepEvaluation[] = [];

  let i = 0;
  while (i < data.steps.length) {
    const primary = data.steps[i];
    const next = data.steps[i + 1];
    const suggestion =
      primary.kind === "input" && next && next.kind === "suggestion"
        ? next
        : primary.kind === "suggestion"
          ? primary
          : null;

    // Recompute from the raw input state: infer footprints, derive remaining.
    const { grid, located } = deriveConfirmedState(primary.grid, dims);
    const remaining: Item[] = allIdx
      .filter((x) => !located.has(x))
      .map((x) => ({ count: 1, ...dims.get(x)! }));
    const complete = remaining.length === 0;

    let solverTop: string[] = [];
    let topScore = 0;
    const scoreByCell = new Map<string, number>();
    if (!complete) {
      const result = solve(toNumericGrid(grid), remaining);
      solverTop = result.top.map((c) => `${c.row},${c.col}`);
      topScore = result.scores.length ? result.scores[0].score : 0;
      for (const s of result.scores) scoreByCell.set(`${s.row},${s.col}`, s.score);
    }

    const recorded = suggestion ? cellsWhere(suggestion.grid, (c) => !!c.suggested) : [];
    const topSet = new Set(solverTop);
    const recordedMax = recorded.reduce((m, c) => Math.max(m, scoreByCell.get(c) ?? 0), 0);
    out.push({
      step: primary.step,
      suggestionStep: suggestion ? suggestion.step : null,
      label: primary.label,
      note: primary.note,
      remaining,
      located: [...located],
      inputGrid: primary.grid,
      grid,
      solverTop,
      recorded,
      shared: recorded.filter((c) => topSet.has(c)),
      sheetOnly: recorded.filter((c) => !topSet.has(c)),
      solverDominatesSheet: topScore + 1e-9 >= recordedMax,
      hasSuggestion: !!suggestion,
      complete,
    });

    // Skip the folded suggestion step when it followed an input.
    i += primary.kind === "input" && suggestion ? 2 : 1;
  }

  return out;
}

export const walkthrough = walkthroughData as unknown as Walkthrough;
