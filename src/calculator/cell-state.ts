export type Terrain = "wall" | "soil" | "rock";

export interface Cell {
  terrain: Terrain;
  hitsRemaining: number;
  revealedEmpty?: boolean;
  item?: { index: number; part?: string };
  confirmed?: boolean;
  // When `confirmed`, the index of the located item whose footprint covers this
  // cell — lets the UI colour the cell by its owning item.
  confirmedItem?: number;
  // Covered by some-but-not-all candidate footprints of a found item whose
  // placement isn't yet pinned (e.g. the two possible edges of a length-4
  // internal find). Reserved ("barked off") but not a certain item cell.
  tentative?: boolean;
  eliminated?: boolean;
  suggested?: boolean;
}

const ITEM_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export function itemEmoji(index: number): string {
  return ITEM_EMOJI[index - 1] ?? "⛏️";
}

// Non-placeable cells map to 0 — no remaining item can be placed over them:
// walls, revealed-empty, cells holding a found item, cells confirmed as a
// located item's footprint, and eliminated cells. Diggable cells carry their
// remaining hit count (soil 1, rock 2).
export function toNumericGrid(cells: Cell[][]): number[][] {
  return cells.map((row) =>
    row.map((cell) => {
      if (
        cell.terrain === "wall" ||
        cell.revealedEmpty ||
        cell.item ||
        cell.confirmed ||
        cell.tentative ||
        cell.eliminated
      )
        return 0;
      return cell.hitsRemaining;
    }),
  );
}

// Walkthrough notation (transition-states sheet legend).
export function cellGlyph(cell: Cell): string {
  if (cell.item) return itemEmoji(cell.item.index) + (cell.item.part ?? "");
  if (cell.revealedEmpty) return "0️⃣";
  if (cell.confirmed) return cell.hitsRemaining >= 2 ? "🟢" : "🟩";
  if (cell.tentative) return cell.terrain === "rock" ? "🟧" : "🟠";
  if (cell.eliminated) return cell.terrain === "rock" ? "🔴" : "🟥";
  if (cell.suggested) return cell.terrain === "rock" ? "⚒️" : "⛏️";
  if (cell.terrain === "wall") return "⬛";
  if (cell.terrain === "rock") return "🪨";
  return "🟫";
}
