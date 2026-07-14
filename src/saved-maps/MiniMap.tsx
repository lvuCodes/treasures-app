import { boundingBox, range } from "../grid";

// Non-interactive terrain preview (bounding-box cropped) — the face of a saved-
// map card. Styled by saved-maps.css (`.mini-map` / `.mini-cell`), which the
// SavedMaps component imports.
export function MiniMap({ grid }: { grid: number[][] }) {
  const { r0, r1, c0, c1 } = boundingBox(grid);
  const rs = range(r0, r1);
  const cs = range(c0, c1);
  return (
    <div
      className="mini-map"
      style={{ gridTemplateColumns: `repeat(${cs.length}, var(--mini-cell))` }}
    >
      {rs.map((r) =>
        cs.map((c) => (
          <span key={`${r},${c}`} className={`mini-cell terrain-${grid[r][c]}`} />
        )),
      )}
    </div>
  );
}
