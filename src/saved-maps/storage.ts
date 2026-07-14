// Saved-map persistence. Maps persist only the terrain grid (never item counts)
// under one namespaced localStorage key. The pure `appendMap` decides whether a
// draw is worth saving (non-empty, not a placement-independent duplicate); the
// storage read/write are the only side effects and both tolerate a blocked
// localStorage (file:// origins), so the module stays importable in Node.
import { mapSignature } from "../grid";

// localStorage key. Namespaced so it can coexist with a host app's own keys.
export const SAVED_MAPS_KEY = "mogo-saved-maps";

// Read the persisted maps, or [] when empty / unavailable / malformed.
export function loadSavedMaps(): number[][][] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_MAPS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // localStorage may be blocked on file:// origins
  }
}

// Persist the maps; swallows storage failures (file:// / disabled storage), in
// which case the saved maps just won't survive a reload.
export function persistSavedMaps(maps: number[][][]) {
  try {
    localStorage.setItem(SAVED_MAPS_KEY, JSON.stringify(maps));
  } catch {
    /* file:// origin may block localStorage — saved maps just won't persist */
  }
}

// The result of trying to append a drawn map: the new list, or why it was
// skipped (empty draw / a placement-independent duplicate of an existing map).
export type SaveOutcome =
  | { ok: true; maps: number[][][] }
  | { ok: false; reason: "empty" | "duplicate" };

// Pure append decision: uniqueness is judged on the bounding-box crop
// (mapSignature), so the same shape drawn in a different corner isn't saved
// twice. The appended grid is deep-cloned so later edits to the live grid don't
// mutate the stored copy.
export function appendMap(maps: number[][][], grid: number[][]): SaveOutcome {
  const sig = mapSignature(grid);
  if (!sig) return { ok: false, reason: "empty" };
  if (maps.some((m) => mapSignature(m) === sig)) return { ok: false, reason: "duplicate" };
  return { ok: true, maps: [...maps, grid.map((row) => [...row])] };
}
