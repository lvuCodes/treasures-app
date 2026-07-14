import type { MouseEvent } from "react";
import { SIZE, range } from "../grid";
import { cellKey } from "../calculator/session";
import type { DragSize } from "./useMapPaint";
import "./map-input.css";

interface InputGridProps {
  grid: number[][];
  paintDown: (e: MouseEvent, r: number, c: number) => void;
  paintEnter: (e: MouseEvent, r: number, c: number) => void;
  cellClick: (r: number, c: number) => void;
  dragSize: DragSize | null;
}

// The editable input map: a full SIZE×SIZE grid of cells that cycle terrain on
// click and paint rectangles on drag. Presentational — all paint state + handlers
// come from useMapPaint. The live drag-size readout is a fixed-position overlay,
// so its position in the tree doesn't matter.
export function InputGrid({ grid, paintDown, paintEnter, cellClick, dragSize }: InputGridProps) {
  const cells = range(0, SIZE - 1);
  return (
    <>
      <p className="hint">
        Cells start as wall. Click to cycle <b>dig → rock → wall</b> (tan = dig, 🪨 = rock, dark = wall).
        <br />
        Click and drag to make rectangle inputs.
      </p>
      <div
        className="grid"
        role="grid"
        aria-label="map"
        style={{ gridTemplateColumns: `repeat(${SIZE}, 40px)` }}
      >
        {cells.map((r) =>
          cells.map((c) => {
            const key = cellKey(r, c);
            return (
              <button
                key={key}
                className={`cell terrain-${grid[r][c]}`}
                onMouseDown={(e) => paintDown(e, r, c)}
                onMouseEnter={(e) => paintEnter(e, r, c)}
                onClick={() => cellClick(r, c)}
                onContextMenu={(e) => e.preventDefault()} // no context menu while drawing
                aria-label={key}
              >
                {grid[r][c] === 2 ? "🪨" : ""}
              </button>
            );
          }),
        )}
      </div>

      {/* Drag-rectangle size readout — only once a side exceeds 4 cells. */}
      {dragSize && (dragSize.w > 4 || dragSize.h > 4) && (
        <div
          className="drag-size"
          style={{ left: dragSize.x, top: dragSize.y, transform: dragSize.transform }}
        >
          {dragSize.w}×{dragSize.h}
        </div>
      )}
    </>
  );
}
