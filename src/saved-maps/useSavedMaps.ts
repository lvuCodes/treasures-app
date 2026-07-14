import { useCallback, useEffect, useRef, useState } from "react";
import { appendMap, loadSavedMaps, persistSavedMaps } from "./storage";

// React binding for saved-map retention. Owns the persisted list, the transient
// save/load status line, and the carousel scroll state. Pure decisions live in
// storage.ts; this hook wraps them in state + effects. The shell wires the two
// cross-feature seams (which grid to save, what to do on load).
export function useSavedMaps() {
  const [maps, setMaps] = useState<number[][][]>(loadSavedMaps);
  const [status, setStatus] = useState("");
  const cardsRef = useRef<HTMLDivElement>(null);
  const [cardEnds, setCardEnds] = useState({ atStart: true, atEnd: false });

  // Auto-dismiss the save/load status line after ~5s.
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(""), 5000);
    return () => clearTimeout(id);
  }, [status]);

  // Track whether the carousel is scrolled to either end, to disable the arrows.
  const updateCardEnds = useCallback(() => {
    const el = cardsRef.current;
    if (!el) return;
    setCardEnds({
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);
  // Recompute on mount and whenever the map set changes (it affects width).
  useEffect(() => {
    updateCardEnds();
  }, [maps, updateCardEnds]);

  // Save the current grid's terrain if non-empty and not a duplicate. `silent`
  // suppresses the status line — used by the auto-save on Calculate.
  const save = useCallback((grid: number[][], silent = false) => {
    setMaps((cur) => {
      const outcome = appendMap(cur, grid);
      if (!outcome.ok) {
        if (!silent) {
          setStatus(outcome.reason === "empty" ? "Draw a map first." : "Map already saved.");
        }
        return cur;
      }
      persistSavedMaps(outcome.maps);
      if (!silent) setStatus("Map saved.");
      return outcome.maps;
    });
  }, []);

  const remove = useCallback((i: number) => {
    setMaps((cur) => {
      const next = cur.filter((_, ix) => ix !== i);
      persistSavedMaps(next);
      return next;
    });
    setStatus("");
  }, []);

  // Scroll the card strip by one viewport (≈ three cards).
  const scrollBy = useCallback((dir: number) => {
    const el = cardsRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }, []);

  return { maps, status, setStatus, cardsRef, cardEnds, updateCardEnds, save, remove, scrollBy };
}
