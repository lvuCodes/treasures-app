import { useMemo, useReducer } from "react";
import {
  cellKey,
  recordedFootprints,
  type DigCode,
  type ItemDims,
} from "../calculator/session";
import { initSession, sessionReducer } from "./reducer";

// Generic over the concrete item type `T` (which must at least be ItemDims) so
// the derived `expandedItems` keeps any extra fields the catalog carries — e.g.
// the display `label` the item table and recorder render. The reducer only ever
// needs the ItemDims subset.
interface DigSessionConfig<T extends ItemDims> {
  grid: number[][];
  itemTypes: T[];
  // Seam: called with the grid when a valid Calculate/Recalculate is submitted
  // (before the solve), e.g. to auto-save the map. Keeps the reducer pure.
  onCalculate?: (grid: number[][]) => void;
}

// React binding for the session state machine. Holds the coupled cluster in a
// useReducer over the pure sessionReducer, derives the read-models the UI needs,
// and threads the live grid + item catalog into each action. The picker and any
// dev overlay tooling stay OUT of here — the shell composes those around the
// generic `commit`/`recordCell` (which take an opaque overlay tag).
export function useDigSession<T extends ItemDims>({ grid, itemTypes, onCalculate }: DigSessionConfig<T>) {
  const [state, dispatch] = useReducer(sessionReducer, itemTypes.length, initSession);
  const { counts, dug, parts, overlay, result, repick, repickBase, error, history } = state;

  const total = counts.reduce((a, b) => a + b, 0);
  const locked = result !== null;
  // The item panel shows the steppers during initial input and while re-picking;
  // the map stays locked during a re-pick so its dig state is kept.
  const inputMode = !locked || repick;

  // One entry per individual hidden item, in numbered order.
  const expandedItems = useMemo(
    () => itemTypes.flatMap((t, i) => Array.from({ length: counts[i] }, () => t)),
    [counts, itemTypes],
  );

  // Items recorded somewhere on the map (auto-found).
  const foundSet = useMemo(() => {
    const s = new Set<number>();
    for (const v of dug.values()) if (typeof v === "number" && v >= 1) s.add(v);
    return s;
  }, [dug]);

  // Kept found pieces shown (read-only) while re-picking — distinct recorded item
  // codes resolved against the pre-zeroed inventory snapshot.
  const repickFound = useMemo(() => {
    if (!repick) return [];
    const codes = [...new Set(dug.values())]
      .filter((v): v is number => typeof v === "number" && v >= 1)
      .sort((a, b) => a - b);
    return codes.map((code) => ({
      code,
      dims: repickBase[code - 1],
      located: result?.located.has(code) ?? false,
    }));
  }, [repick, dug, repickBase, result]);

  // Each recorded item's occupied cells — reused by the recorder when filtering
  // feasible parts for every candidate item.
  const footprints = useMemo(
    () => recordedFootprints(grid, dug, parts, expandedItems),
    [grid, dug, parts, expandedItems],
  );

  const changeCount = (i: number, delta: number) => dispatch({ type: "changeCount", i, delta });

  // Apply a cell change (dig + part + opaque overlay tag), pushing prior state to
  // history and recomputing. An undefined value clears that field.
  const commit = (
    key: string,
    dugVal: DigCode | undefined,
    glyph: string | undefined,
    overlayTag: string | undefined,
  ) =>
    dispatch({ type: "commit", key, dug: dugVal, glyph, overlay: overlayTag, grid, items: expandedItems });

  const recordCell = (r: number, c: number, dugVal: DigCode, glyph?: string, overlayTag?: string) =>
    commit(cellKey(r, c), dugVal, glyph, overlayTag);

  const clearCell = (r: number, c: number) => {
    const key = cellKey(r, c);
    if (dug.has(key) || parts.has(key)) commit(key, undefined, undefined, undefined);
  };

  const undo = () => dispatch({ type: "undo", grid, items: expandedItems });
  const startSession = () => dispatch({ type: "startSession", grid, items: expandedItems });
  const resetToInput = () => dispatch({ type: "resetToInput" });

  const submit = () => {
    // During re-pick the count is the *hidden* declaration only — 0 is valid.
    if (!repick && total === 0) {
      dispatch({ type: "setError", error: "Add at least one item (count > 0)." });
      return;
    }
    onCalculate?.(grid); // seam: auto-save the map (silently) on Calculate
    dispatch({ type: "submit", grid, items: expandedItems, itemTypes });
  };

  const resetItems = () => dispatch({ type: "resetItems", expandedItems });
  const newSession = () => dispatch({ type: "newSession" });
  const clearCounts = () => dispatch({ type: "clearCounts" });

  return {
    // state
    counts,
    dug,
    parts,
    overlay,
    result,
    repick,
    error,
    history,
    // derived read-models
    total,
    locked,
    inputMode,
    expandedItems,
    foundSet,
    repickFound,
    footprints,
    // actions
    changeCount,
    commit,
    recordCell,
    clearCell,
    undo,
    startSession,
    resetToInput,
    submit,
    resetItems,
    newSession,
    clearCounts,
  };
}
