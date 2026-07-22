// The item catalog: the eight supported item shapes plus the shared per-item
// display vocabulary (keycaps, ring/swatch colours). This is domain data the
// inventory, map-display, and recorder features all read, so it lives in one
// home and every consumer imports it. Pure and framework-free.
import type { ItemDims } from "../calculator/session";

// A selectable item shape: its dims plus a display label. `long` ≥ `short`;
// both orientations are considered by the solver.
export interface ItemType extends ItemDims {
  label: string;
}

// The eight supported shapes, in the order shown in the item table. Not marked
// readonly so it stays assignable to the calculator's `ItemDims[]` params.
export const ITEM_TYPES: ItemType[] = [
  { label: "1×1", long: 1, short: 1 },
  { label: "1×2", long: 2, short: 1 },
  { label: "1×3", long: 3, short: 1 },
  { label: "1×4", long: 4, short: 1 },
  { label: "2×2", long: 2, short: 2 },
  { label: "2×3", long: 3, short: 2 },
  { label: "2×4", long: 4, short: 2 },
  { label: "3×3", long: 3, short: 3 },
];

// Numbered keycaps for items 1..10 (the app caps at 10 items).
export const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

// Per-item ring / swatch colours. The actual hues live in CSS custom properties
// (--item-0..--item-9) so they adapt per theme, ANSI-style: a bright palette on
// dark themes, a darker one on light themes (see index.css). Max 10 items.
export const ITEM_COLOR_COUNT = 10;

// Forced-cell ring (a cell guaranteed to hold an item, owner not yet known).
export const FORCED_COLOR = "var(--item-forced)";

// The CSS custom-property reference for item `index` (1-based), wrapping every
// ITEM_COLOR_COUNT items so an 11th item reuses the first hue.
export function itemColor(index: number): string {
  return `var(--item-${(index - 1) % ITEM_COLOR_COUNT})`;
}
