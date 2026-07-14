// The pure session state machine. Every recording transition (commit / undo /
// start / submit / re-pick) is a reducer case over SessionState, so the coupled
// dug/parts/overlay/history/result cluster lives in one testable place and
// `undo(commit(s)) === s` is provable. No React, no DOM — the hook (useDigSession)
// is the only thing that adds effects.
import { withEntry } from "../grid";
import { evaluate, remapRepick, type DigCode, type ItemDims } from "../calculator/session";
import type { HistoryEntry, SessionAction, SessionState } from "./types";

// A fresh session for `itemCount` item types.
export function initSession(itemCount: number): SessionState {
  return {
    counts: new Array<number>(itemCount).fill(0),
    dug: new Map(),
    parts: new Map(),
    overlay: new Map(),
    history: [],
    result: null,
    repick: false,
    repickBase: [],
    error: "",
  };
}

// Fresh, independent empty recording maps + history (never shared across states).
function emptyRecording() {
  return {
    dug: new Map<string, DigCode>(),
    parts: new Map<string, string>(),
    overlay: new Map<string, string>(),
    history: [] as HistoryEntry[],
  };
}

// Recompute the evaluation from the recording maps. Overlay-tagged cells stay
// passable for located-footprint inference (the core doesn't know why).
function evaluated(
  grid: number[][],
  dug: SessionState["dug"],
  parts: SessionState["parts"],
  overlay: SessionState["overlay"],
  items: ItemDims[],
) {
  return evaluate(grid, dug, parts, items, new Set(overlay.keys()));
}

// Distinct recorded item codes (found pieces) — the re-pick slot count.
function foundCount(dug: SessionState["dug"]): number {
  const seen = new Set<number>();
  for (const v of dug.values()) if (typeof v === "number" && v >= 1) seen.add(v);
  return seen.size;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "changeCount": {
      const locked = state.result !== null;
      if (locked && !state.repick) return state; // editable during input + re-pick
      const { i, delta } = action;
      const { counts } = state;
      // Kept found pieces already consume slots during re-pick — count them
      // toward the 10-item cap so found + declared-hidden never exceeds it.
      const base = state.repick ? foundCount(state.dug) : 0;
      const next = Math.max(0, counts[i] + delta);
      const othersTotal = counts.reduce((a, b, ix) => (ix === i ? a : a + b), 0);
      if (base + othersTotal + next > 10) return state; // total capped at 10
      return { ...state, counts: counts.map((v, ix) => (ix === i ? next : v)) };
    }

    case "commit": {
      const dug = withEntry(state.dug, action.key, action.dug);
      const parts = withEntry(state.parts, action.key, action.glyph);
      const overlay = withEntry(state.overlay, action.key, action.overlay);
      const history = [
        ...state.history,
        {
          key: action.key,
          prevDug: state.dug.get(action.key),
          prevPart: state.parts.get(action.key),
          prevOverlay: state.overlay.get(action.key),
        },
      ];
      return {
        ...state,
        dug,
        parts,
        overlay,
        history,
        result: evaluated(action.grid, dug, parts, overlay, action.items),
      };
    }

    case "undo": {
      if (state.history.length === 0) return state;
      const last = state.history[state.history.length - 1];
      const dug = withEntry(state.dug, last.key, last.prevDug);
      const parts = withEntry(state.parts, last.key, last.prevPart);
      const overlay = withEntry(state.overlay, last.key, last.prevOverlay);
      return {
        ...state,
        dug,
        parts,
        overlay,
        history: state.history.slice(0, -1),
        result: evaluated(action.grid, dug, parts, overlay, action.items),
      };
    }

    case "startSession": {
      // Clear all recorded digs/parts and recompute from the bare map + items.
      const fresh = emptyRecording();
      return {
        ...state,
        ...fresh,
        result: evaluated(action.grid, fresh.dug, fresh.parts, fresh.overlay, action.items),
      };
    }

    case "resetToInput":
      return { ...state, ...emptyRecording(), result: null, repick: false, error: "" };

    case "submit": {
      if (state.repick) {
        // Keep every found piece, re-index it into the new inventory (found +
        // newly-declared hidden), and re-solve against the kept digs.
        const { counts, dug, items } = remapRepick(
          state.repickBase,
          state.dug,
          state.counts,
          action.itemTypes,
        );
        return {
          ...state,
          counts,
          dug,
          history: [], // undo can't cross the re-pick remap boundary
          repick: false,
          error: "",
          result: evaluated(action.grid, dug, state.parts, state.overlay, items),
        };
      }
      const fresh = emptyRecording();
      return {
        ...state,
        ...fresh,
        error: "",
        result: evaluated(action.grid, fresh.dug, fresh.parts, fresh.overlay, action.items),
      };
    }

    case "resetItems":
      // Keep the map + digs; zero the counts and swap to the steppers so the
      // player re-declares the still-hidden inventory. The map stays frozen.
      return {
        ...state,
        repickBase: action.expandedItems,
        counts: state.counts.map(() => 0),
        repick: true,
        error: "",
      };

    case "newSession":
      // Grid reset is the shell's job; here we zero counts + clear the session.
      return {
        ...state,
        ...emptyRecording(),
        counts: state.counts.map(() => 0),
        result: null,
        repick: false,
        error: "",
      };

    case "clearCounts":
      if (state.result !== null) return state; // input mode only
      return { ...state, counts: state.counts.map(() => 0) };

    case "setError":
      return { ...state, error: action.error };
  }
}
