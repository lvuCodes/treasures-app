import { useEffect, useRef, useState } from "react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { fillRect } from "../calculator/session";

// Live size readout for the current drag-rectangle, shown by the cursor once any
// side exceeds a few cells. `transform` places it in the quadrant opposite the
// drag so the pointer never covers it.
export interface DragSize {
  w: number;
  h: number;
  x: number;
  y: number;
  transform: string;
}

interface MapPaintArgs {
  grid: number[][];
  setGrid: Dispatch<SetStateAction<number[][]>>;
  locked: boolean;
}

// Click-and-drag terrain painting for the input map. A plain click cycles one
// cell (wall→soil→rock→wall); a drag from the start cell fills that rectangle
// with the start cell's next state. Owns all the transient drag refs + the live
// size readout, and tears down its window listeners symmetrically.
export function useMapPaint({ grid, setGrid, locked }: MapPaintArgs) {
  // `dragged` suppresses the click-cycle a drag would otherwise trigger;
  // `baseGrid` is the grid snapshot at drag start so each move re-fills from a
  // clean base (a rectangle, not a trail).
  const painting = useRef(false);
  const dragged = useRef(false);
  const dragStart = useRef<[number, number] | null>(null);
  const baseGrid = useRef<number[][] | null>(null);
  // The next state in the click cycle from the start cell — the drag steps the
  // whole rectangle one stage.
  const fillValue = useRef(1);
  const [dragSize, setDragSize] = useState<DragSize | null>(null);

  // End any drag-paint when the mouse is released. `mouseup` covers releases over
  // the document; the `mousemove` no-buttons check catches a release that
  // happened off-window (where no mouseup reaches us) the moment the cursor
  // returns; `blur` covers losing the window entirely.
  useEffect(() => {
    const stop = () => {
      painting.current = false;
      setDragSize(null);
    };
    const onMove = (e: globalThis.MouseEvent) => {
      if (painting.current && e.buttons === 0) stop();
    };
    window.addEventListener("mouseup", stop);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("blur", stop);
    };
  }, []);

  function cycleCell(r: number, c: number) {
    if (locked) return;
    setGrid((g) =>
      g.map((row, ri) => (ri === r ? row.map((v, ci) => (ci === c ? (v + 1) % 3 : v)) : row)),
    );
  }

  // Mouse-down begins a potential drag, snapshotting the grid so the rectangle
  // re-fills from a clean base on every move. A pure click (no drag) falls
  // through to cycleCell.
  function paintDown(e: MouseEvent, r: number, c: number) {
    if (locked) return;
    e.preventDefault();
    painting.current = true;
    dragged.current = false;
    dragStart.current = [r, c];
    baseGrid.current = grid.map((row) => [...row]);
    fillValue.current = (grid[r][c] + 1) % 3; // wall→soil→rock→wall, matching click cycle
    setDragSize(null);
  }

  // Fill the rectangle spanned by the drag-start cell and (r,c), applied over the
  // start-of-drag snapshot so the shape is always a rectangle.
  function paintEnter(e: MouseEvent, r: number, c: number) {
    if (locked || !painting.current) return;
    const s = dragStart.current;
    const base = baseGrid.current;
    if (!s || !base) return;
    dragged.current = true;
    setGrid(fillRect(base, s[0], s[1], r, c, fillValue.current));
    // Offset into the quadrant opposite the drag direction: dragging right/down
    // pushes the readout left/up of the cursor, and vice-versa.
    const gap = 14;
    const near = `${gap}px`;
    const far = `calc(-100% - ${gap}px)`;
    const tx = c - s[1] < 0 ? near : far;
    const ty = r - s[0] < 0 ? near : far;
    setDragSize({
      w: Math.abs(c - s[1]) + 1,
      h: Math.abs(r - s[0]) + 1,
      x: e.clientX,
      y: e.clientY,
      transform: `translate(${tx}, ${ty})`,
    });
  }

  function cellClick(r: number, c: number) {
    if (dragged.current) {
      dragged.current = false; // this click ends a drag — don't also cycle
      return;
    }
    cycleCell(r, c);
  }

  return { paintDown, paintEnter, cellClick, dragSize };
}
