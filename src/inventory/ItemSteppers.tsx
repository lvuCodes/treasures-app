import { ITEM_TYPES } from "./item-catalog";
import "./inventory.css";

interface ItemSteppersProps {
  counts: number[];
  onChange: (i: number, delta: number) => void;
  // True once the 10-item cap is reached — disables every increment.
  atCap: boolean;
}

// Two-column count steppers, one per item shape. Thin (1×n) items sit in the
// left column and wide (2×n, 3×3) in the right, so 1×2 / 2×2 (etc.) can't be
// misclicked for one another. Presentational: counts + callbacks come from the
// session.
export function ItemSteppers({ counts, onChange, atCap }: ItemSteppersProps) {
  return (
    <div className="item-grid">
      {[
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ].map((indices, col) => (
        <div className="item-col" key={col}>
          {indices.map((i) => {
            const t = ITEM_TYPES[i];
            return (
              <div className="item-card" key={t.label}>
                <span className="item-label">{t.label}</span>
                <div className="stepper">
                  <button onClick={() => onChange(i, -1)} aria-label={`decrease ${t.label}`}>
                    −
                  </button>
                  <span className="count">{counts[i]}</span>
                  <button
                    onClick={() => onChange(i, +1)}
                    disabled={atCap}
                    aria-label={`increase ${t.label}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
