import type { ReactNode } from "react";
import { cellKey, feasibleGlyphs, partLayout, type DigCode } from "../calculator/session";
import { KEYCAPS, type ItemType } from "../inventory";
import type { PickerAnchor } from "./usePicker";
import "./recorder.css";

interface PickerProps {
  anchor: PickerAnchor;
  // Expanded inventory (one entry per hidden item, carrying its label).
  items: ItemType[];
  grid: number[][];
  dug: Map<string, DigCode>;
  located: Set<number>; // item indices whose footprint is pinned
  footprints: Map<number, string[]>;
  // Non-null → the part-selection sub-view for that item; null → the item grid.
  pickerItem: number | null;
  // "Trust the user over the solver": skip feasibility filtering (a reveal is
  // ground truth). Also changes the title.
  forceMode: boolean;
  onApplyPart: (itemIndex: number, glyph: string | undefined) => void;
  onEmpty: () => void;
  onCracked: () => void;
  onClear: () => void;
  onClose: () => void;
  onSelectItem: (itemIndex: number | null) => void;
  // Extra controls under the item grid (an optional dev footer); undefined in prod.
  footerSlot?: ReactNode;
}

// The right-click recorder modal. Two views: choose an item to place (filtered
// to feasible/unlocated items — forceMode, or an empty-cell override, lifts the
// located filter so a deduction can be overruled), then choose which
// part of a multi-cell item sits under the cursor. Presentational — every action
// and the feasibility inputs come from the session via the shell.
export function Picker({
  anchor,
  items,
  grid,
  dug,
  located,
  footprints,
  pickerItem,
  forceMode,
  onApplyPart,
  onEmpty,
  onCracked,
  onClear,
  onClose,
  onSelectItem,
  footerSlot,
}: PickerProps) {
  const { r, c } = anchor;
  // A cell the player already recorded as empty (0️⃣) is being corrected. Going
  // to 0 can "solve" the map by deducing the last item into the only remaining
  // spot — or merely locate an item elsewhere — which drops that item from the
  // picker, leaving no way (especially on mobile, with no right-click) to say
  // "this empty slot is actually an item". At an empty anchor cell we trust the
  // player to overrule the solver's *deduction* only: the `located` filter is
  // lifted, but geometric feasibility (walls / edges / other items) and the
  // found filter still apply, so only genuinely viable pieces and parts show.
  const emptyOverride = dug.get(cellKey(r, c)) === 0;
  // Pieces the player has actually recorded somewhere (found). These are used up,
  // so — unlike a piece the solver merely deduced — they are never offered again.
  const found = new Set<number>();
  for (const v of dug.values()) if (typeof v === "number" && v >= 1) found.add(v);
  const feasibleFor = (itemIndex: number) =>
    feasibleGlyphs(grid, dug, items, footprints, r, c, itemIndex);

  return (
    <div
      className="picker-backdrop"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="picker"
        style={{
          left: anchor.x,
          top: anchor.y,
          // grow leftward from the anchor when flipped (keeps it on-screen)
          transform: anchor.openLeft ? "translateX(-100%)" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {pickerItem === null ? (
          <>
            <p className="picker-title">
              {forceMode ? "🟨 Record revealed item" : "Record found item here"}
            </p>
            <div className="picker-grid">
              {items.map((t, i) => {
                const already = dug.get(cellKey(r, c)) === i + 1;
                // A piece the player has already recorded is exhausted — never
                // offer it again (the only 2×2, once found, is off the menu).
                // forceMode is the dev reveal path: it shows even found pieces so
                // a mis-record can be corrected.
                if (!forceMode && found.has(i + 1) && !already) return null;
                if (!forceMode) {
                  // Hide a solver-pinned (located) piece — UNLESS this is an
                  // empty-cell override, where the player overrules the deduction.
                  if (located.has(i + 1) && !already && !emptyOverride) return null;
                  // Never offer a piece that cannot physically fit here (walls /
                  // edges / other items). Applies even at an empty override — only
                  // viable pieces show.
                  if (feasibleFor(i + 1).size === 0) return null;
                }
                return (
                  <button
                    key={i}
                    onClick={() =>
                      t.long === 1 && t.short === 1
                        ? onApplyPart(i + 1, undefined)
                        : onSelectItem(i + 1)
                    }
                  >
                    {KEYCAPS[i]} {t.label}
                  </button>
                );
              })}
            </div>
            <div className="picker-foot">
              <button onClick={onEmpty}>Empty 0️⃣</button>
              {grid[r][c] === 2 && <button onClick={onCracked}>🪨 Rock</button>}
              <button onClick={onClear}>⛏️ Hammer</button>
              <button onClick={onClose}>Cancel</button>
            </div>
            {footerSlot}
          </>
        ) : (
          <>
            <p className="picker-title">
              {KEYCAPS[pickerItem - 1]} {items[pickerItem - 1].label} — which part?
            </p>
            {(() => {
              const dims = items[pickerItem - 1];
              // Force mode (dev reveal) allows any part; otherwise — including an
              // empty-cell override — restrict to parts that physically fit.
              const feasible = forceMode ? null : feasibleFor(pickerItem);
              return (
                <div className="picker-parts">
                  {partLayout(dims.long, dims.short).flatMap((row, ri) =>
                    row.map((glyph, ci) =>
                      !feasible || feasible.has(glyph) ? (
                        <button
                          key={`${ri}-${ci}`}
                          className="part-cell"
                          onClick={() => onApplyPart(pickerItem, glyph)}
                        >
                          {glyph}
                        </button>
                      ) : (
                        <span key={`${ri}-${ci}`} className="part-cell empty" />
                      ),
                    ),
                  )}
                </div>
              );
            })()}
            <div className="picker-foot">
              <button onClick={() => onSelectItem(null)}>← Back</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
