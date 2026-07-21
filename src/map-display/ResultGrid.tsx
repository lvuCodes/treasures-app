import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { boundingBox, range } from "../grid";
import { cellKey, type DigCode, type Evaluation } from "../calculator/session";
import { FORCED_COLOR, KEYCAPS, itemColor } from "../inventory";
import { DIG_GLYPH, MAP_LEGEND, TERRAIN_GLYPH, ringShadow } from "./legend";
import "./map-display.css";

// The state a per-cell overlay feature inspects to decide whether to draw its own
// glyph / background. `tag` is the opaque overlay tag recorded at the cell; the
// core never interprets it.
export interface OverlayCellState {
  tag: string | undefined;
  terrain: number;
  isCracked: boolean;
  isEmpty: boolean;
  isItem: boolean;
}

// An optional overlay renderer. Returning a `node` overrides the cell's core
// glyph; a `className` is appended to the cell (e.g. a background marker).
export type OverlaySlot = (
  key: string,
  cell: OverlayCellState,
) => { node?: ReactNode; className?: string } | undefined;

interface ResultGridProps {
  grid: number[][];
  result: Evaluation; // non-null: this grid only renders in solve mode
  dug: Map<string, DigCode>;
  // Opaque per-cell overlay tags; only read to hand each cell's tag to the slot.
  overlay: Map<string, string>;
  onCellClick: (e: MouseEvent, r: number, c: number) => void;
  onCellContextMenu: (e: MouseEvent, r: number, c: number) => void;
  overlaySlot?: OverlaySlot;
}

// The solve-mode board: the terrain grid overlaid with the solver's per-cell
// verdict (recommended / confirmed / forced / tentative / eliminated), plus a
// legend. Cropped to the used region. A feature can paint its own per-cell
// glyph/background through `overlaySlot` without the core naming it.
export function ResultGrid({
  grid,
  result,
  dug,
  overlay,
  onCellClick,
  onCellContextMenu,
  overlaySlot,
}: ResultGridProps) {
  const ok = result.kind === "ok";
  const recommended = ok ? result.top : null;
  const eliminated = ok ? result.eliminated : null;
  const forced = ok ? result.forced : null;
  const forcedItem = ok ? result.forcedItem : null;

  const box = boundingBox(grid);
  const rows = range(box.r0, box.r1);
  const cols = range(box.c0, box.c1);

  return (
    <>
      <div
        className="grid"
        role="grid"
        aria-label="map"
        style={{ "--cols": cols.length } as CSSProperties}
      >
        {rows.map((r) =>
          cols.map((c) => {
            const v = grid[r][c];
            const key = cellKey(r, c);
            const code = dug.get(key);
            const cc = result.confirmed[r]?.[c];
            const isEmpty = code === 0;
            const isItem = typeof code === "number" && code >= 1;
            const isCracked = code === "cracked";
            const isConfirmed = !isItem && !!cc?.confirmed;
            const isForced = !isItem && !isEmpty && !isConfirmed && (forced?.has(key) ?? false);
            const deducedItem = isForced ? forcedItem?.get(key) : undefined;
            const isForcedUnknown = isForced && deducedItem == null; // → purple
            const isTentative = !isItem && !isConfirmed && !isForced && !!cc?.tentative;
            const isDug = isEmpty || isItem;
            const isEliminated =
              !isDug &&
              !isConfirmed &&
              !isForced &&
              !isTentative &&
              (eliminated?.has(key) ?? false);
            const isRec =
              !isDug &&
              !isConfirmed &&
              !isForced &&
              !isTentative &&
              !isEliminated &&
              (recommended?.has(key) ?? false);
            // The known item owning this cell — drives the per-item ring.
            const knownItem = isItem
              ? (code as number)
              : isConfirmed
                ? cc?.confirmedItem
                : deducedItem;
            const ringColor =
              knownItem != null ? itemColor(knownItem) : isForcedUnknown ? FORCED_COLOR : undefined;
            const style = ringColor ? { boxShadow: ringShadow(ringColor) } : undefined;

            // Hand the cell to the overlay feature (if any); it may override the
            // glyph and/or add a background class. The core stays feature-agnostic.
            const over = overlaySlot?.(key, {
              tag: overlay.get(key),
              terrain: v,
              isCracked,
              isEmpty,
              isItem,
            });

            const cls =
              `cell terrain-${v}` +
              (isRec ? " rec" : "") +
              (isDug ? " dug" : "") +
              (knownItem != null ? " item-known" : "") +
              (isForcedUnknown ? " forced" : "") +
              (isTentative ? " tentative" : "") +
              (isEliminated ? " eliminated" : "") +
              (over?.className ? ` ${over.className}` : "") +
              (v === 0 ? " nodig" : ""); // wall in result mode — not diggable

            // Highest-priority state wins, mirroring the class precedence.
            const coreContent = (() => {
              if (isEmpty) return "0️⃣";
              if (isItem) return KEYCAPS[(code as number) - 1] ?? `${code}`;
              if (isConfirmed || deducedItem != null)
                return (cc?.hitsRemaining ?? 0) >= 2 ? "🟢" : "🟩";
              if (isForcedUnknown) return v === 2 && !isCracked ? "🟣" : "🟪";
              if (isTentative) return v === 2 && !isCracked ? "🟠" : "🟧";
              if (isEliminated) return v === 2 && !isCracked ? "🔴" : "🟥";
              if (isRec) return isCracked ? "⛏️" : DIG_GLYPH[v]; // hammer only when recommended
              if (isCracked) return ""; // rock already broken, not recommended
              return TERRAIN_GLYPH[v];
            })();

            return (
              <button
                key={key}
                className={cls}
                style={style}
                onClick={(e) => onCellClick(e, r, c)}
                onContextMenu={(e) => onCellContextMenu(e, r, c)}
                aria-label={key}
              >
                {over?.node ?? coreContent}
              </button>
            );
          }),
        )}
      </div>

      <div className="map-legend" aria-label="map legend">
        {MAP_LEGEND.map(({ icon, label }) => (
          <div key={label} className="legend-item">
            <span className="legend-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="legend-sep" aria-hidden="true">
              •
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
