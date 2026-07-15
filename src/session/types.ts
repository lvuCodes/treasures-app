import type { DigCode, Evaluation, ItemDims } from "../calculator/session";

// One recorded cell change, enough for Undo to restore the cell's prior state.
export interface HistoryEntry {
  key: string;
  prevDug: DigCode | undefined;
  prevPart: string | undefined;
  prevOverlay: string | undefined;
}

// The coupled session state: item counts, the per-cell recording maps, the undo
// history, the latest evaluation, and the re-pick flags. Every recording write
// funnels through the reducer so `commit`/`undo` stay provably inverse.
export interface SessionState {
  counts: number[];
  // "r,c" → DigCode (recorded dig: cracked / empty / item index).
  dug: Map<string, DigCode>;
  // "r,c" → part glyph (which part of an item sits here).
  parts: Map<string, string>;
  // "r,c" → opaque overlay tag. The core never interprets the string; a feature
  // (e.g. a dev overlay tool) stamps and reads its own semantics. A tagged cell
  // stays passable for located-footprint inference (see evaluate's passableCells).
  overlay: Map<string, string>;
  history: HistoryEntry[];
  result: Evaluation | null;
  // "Keep map, reset items" mode: the solved board + recorded digs stay frozen
  // while the item panel reverts to the steppers to re-declare the inventory.
  repick: boolean;
  // Inventory snapshot taken when re-pick begins, so found pieces' shapes survive
  // while `counts` is zeroed for declaring the still-hidden pieces.
  repickBase: ItemDims[];
  error: string;
}

// Actions carry the grid + expanded item list they need to recompute, so the
// reducer never closes over external state (grid lives in the shell; the board
// is frozen while a result exists, so passing it in is safe).
export type SessionAction =
  | { type: "changeCount"; i: number; delta: number }
  | {
      type: "commit";
      key: string;
      dug: DigCode | undefined;
      glyph: string | undefined;
      overlay: string | undefined;
      grid: number[][];
      items: ItemDims[];
    }
  | { type: "undo"; grid: number[][]; items: ItemDims[] }
  | { type: "startSession"; grid: number[][]; items: ItemDims[] }
  | { type: "resetToInput" }
  | { type: "submit"; grid: number[][]; items: ItemDims[]; itemTypes: ItemDims[] }
  | { type: "resetItems"; expandedItems: ItemDims[] }
  | { type: "newSession" }
  | { type: "clearCounts" }
  | { type: "setError"; error: string };
