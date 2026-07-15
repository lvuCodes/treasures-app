import type { DigCode } from "../../calculator/session";
import "./gopher.css";

interface GopherFootProps {
  r: number;
  c: number;
  terrain: number; // grid[r][c]
  forceMode: boolean;
  setForceMode: (on: boolean) => void;
  setOverlayTag: (tag: string | undefined) => void;
  // The shell's recorder wrapper (records the cell + closes the modal).
  recordCell: (r: number, c: number, dugVal: DigCode, glyph?: string, overlayTag?: string) => void;
}

// Dev-only gopher logging row for the recorder modal, filled into the recorder's
// footer slot. A gopher hit reveals the cell: rock cracks (🟨, 1 hit left), soil
// empties (🧀, dug=0). The gopher creatures (🐁/🐀) occupy the cell, so they also
// record dug=0 (non-placeable for the solver). The "Revealed item" toggle arms
// the recorder's force-mode + stamps the "hit" overlay tag on the next placement.
export function GopherFoot({
  r,
  c,
  terrain,
  forceMode,
  setForceMode,
  setOverlayTag,
  recordCell,
}: GopherFootProps) {
  return (
    <div className="picker-foot gopher-foot">
      <button onClick={() => recordCell(r, c, 0, undefined, "initial")}>🐁 Initial gopher</button>
      <button onClick={() => recordCell(r, c, 0, undefined, "revealed")}>🐀 Revealed gopher</button>
      <button
        className={forceMode ? "active" : ""}
        aria-pressed={forceMode}
        onClick={() => {
          const on = !forceMode;
          setForceMode(on);
          setOverlayTag(on ? "hit" : undefined);
        }}
      >
        🟨 Revealed item{forceMode ? " ✓" : ""}
      </button>
      <button
        onClick={() =>
          terrain === 2
            ? recordCell(r, c, "cracked", undefined, "hit")
            : recordCell(r, c, 0, undefined, "hit")
        }
      >
        {terrain === 2 ? "🪤 Gopher crack" : "🧀 Gopher empty"}
      </button>
    </div>
  );
}
