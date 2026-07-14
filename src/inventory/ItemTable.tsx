import { KEYCAPS, itemColor } from "./item-catalog";
import "./inventory.css";

// A found/located item's colour chip, tying the row to its map cells' ring.
function Swatch({ index }: { index: number }) {
  return <span className="item-swatch" style={{ background: itemColor(index) }} />;
}

interface ItemStatusTableProps {
  // One entry per individual hidden item, in numbered order (the label suffices).
  items: { label: string }[];
  foundSet: Set<number>; // 1-based item indices with a recorded hit
  located: Set<number>; // 1-based item indices whose footprint is pinned
}

// Solve-mode item roster: each piece as ❌ not found, ✅ found, or 📍 located.
// Found/located rows carry their item colour (a swatch + a thick left accent).
export function ItemStatusTable({ items, foundSet, located }: ItemStatusTableProps) {
  return (
    <table className="items">
      <thead>
        <tr>
          <th>Item</th>
          <th>Found</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t, i) => {
          const index = i + 1;
          const isFound = foundSet.has(index);
          const isLocated = located.has(index);
          const coloured = isFound || isLocated;
          return (
            <tr key={i} className={coloured ? "is-found" : ""}>
              <td style={coloured ? { borderLeft: `5px solid ${itemColor(index)}` } : undefined}>
                {coloured && <Swatch index={index} />}
                {KEYCAPS[i] ?? `${index}.`} {t.label}
              </td>
              <td>
                {isLocated ? (
                  <>
                    <Swatch index={index} />
                    located
                  </>
                ) : isFound ? (
                  "✅ found"
                ) : (
                  "❌ not found"
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface FoundKeptTableProps {
  // Found pieces kept (read-only) while re-picking the still-hidden inventory.
  rows: { code: number; dims: { long: number; short: number } | undefined; located: boolean }[];
}

// The "found (kept)" table shown during a re-pick: pieces already located on the
// board that survive while the player re-declares the still-hidden inventory.
export function FoundKeptTable({ rows }: FoundKeptTableProps) {
  if (rows.length === 0) return null;
  return (
    <table className="items">
      <thead>
        <tr>
          <th>Found (kept)</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ code, dims, located }) => (
          <tr key={code} className="is-found">
            <td style={{ borderLeft: `5px solid ${itemColor(code)}` }}>
              <Swatch index={code} />
              {KEYCAPS[code - 1] ?? `${code}.`} {dims ? `${dims.long}×${dims.short}` : "?"}
            </td>
            <td>
              {located ? (
                <>
                  <Swatch index={code} />
                  located
                </>
              ) : (
                "✅ found"
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
