import type { ReactNode } from "react";

// Terrain marker glyphs (index by terrain code 0/1/2). Soil/wall show by colour
// alone; rock also gets a 🪨 (grey alone is hard to read). The dig glyphs overlay
// a recommended cell.
export const TERRAIN_GLYPH = ["", "", "🪨"];
export const DIG_GLYPH = ["", "⛏️", "⚒️"];

// A cell-ring box-shadow that stays legible on any theme: the colour ring with a
// dark then light hairline just inside it, so it separates from light soil, dark
// dug, and same-hue theme backgrounds alike.
export function ringShadow(color: string): string {
  return `inset 0 0 0 3px ${color}, inset 0 0 0 4px rgba(0,0,0,0.6), inset 0 0 0 5px rgba(255,255,255,0.45)`;
}

// Legend for the result-mode map. Paired glyphs read soil / rock; #️⃣ stands in
// for any nonzero number (a found item's index).
export const MAP_LEGEND: { icon: ReactNode; label: string }[] = [
  {
    icon: (
      <>
        <span className="legend-swatch terrain-1" /> / 🪨
      </>
    ),
    label: "1 / 2 hits remaining",
  },
  { icon: "⛏️ / ⚒️", label: "recommended hit" },
  { icon: "🟪 / 🟣", label: "1 / 2 hits guaranteed item - item TBD" },
  { icon: "🟥 / 🔴", label: "unviable hit" },
  { icon: "🟧 / 🟠", label: "1 / 2 hits possible item edge" },
  { icon: "🟩 / 🟢", label: "1 / 2 hits found item - border color matches item" },
  { icon: "0️⃣ / #️⃣", label: "no / found item" },
];
