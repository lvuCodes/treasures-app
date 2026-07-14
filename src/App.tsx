import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./App.css";
import { ThemeSwitcher, useTheme } from "./theme";
import {
  SIZE,
  boundingBox,
  centerGrid,
  emptyGrid,
  range,
  withEntry,
} from "./grid";
import { SavedMaps, useSavedMaps } from "./saved-maps";
import {
  FORCED_COLOR,
  ITEM_TYPES,
  KEYCAPS,
  itemColor,
} from "./inventory";
import {
  cellKey,
  evaluate,
  feasibleGlyphs,
  fillRect,
  nextDigCode,
  partGlyphForFootprint,
  partLayout,
  recordedFootprints,
  remapRepick,
  type DigCode,
  type Evaluation,
} from "./calculator/session";

// 0 = wall/empty (default), 1 = dig/soil, 2 = rock — matches the solver's grid.
// Terrain shows by cell colour; rock also gets a 🪨 (grey alone is hard to read).
// The dig glyph overlays a recommended cell.
const TERRAIN_GLYPH = ["", "", "🪨"];
const DIG_GLYPH = ["", "⛏️", "⚒️"];

// Legend for the result-mode map. Paired glyphs read soil / rock; #️⃣ stands in
// for any nonzero number (a found item's index).
const MAP_LEGEND: { icon: ReactNode; label: string }[] = [
  {
    icon: (
      <>
        <span className="legend-swatch terrain-1" /> / 🪨
      </>
    ),
    label: "1 / 2 hits remaining",
  },
  { icon: "⛏️ / ⚒️", label: "recommended hit" },
  { icon: "🟪 / 🟣", label: "1 / 2 hits guaranteed item - item TBD" },
  { icon: "🟥 / 🔴", label: "unviable hit (🐁?)" },
  { icon: "🟧 / 🟠", label: "1 / 2 hits possible item edge" },
  { icon: "🟩 / 🟢", label: "1 / 2 hits found item - border color matches item" },
  { icon: "0️⃣ / #️⃣", label: "no / found item" },
];

// A cell-ring box-shadow that stays legible on any theme: the colour ring with
// a dark then light hairline just inside it, so it separates from light soil,
// dark dug, and same-hue theme backgrounds alike.
function ringShadow(color: string): string {
  return `inset 0 0 0 3px ${color}, inset 0 0 0 4px rgba(0,0,0,0.6), inset 0 0 0 5px rgba(255,255,255,0.45)`;
}

// A recorder modal open over cell (r,c), anchored at viewport (x,y). `openLeft`
// flips it to grow leftward from the anchor when there isn't room on the right.
type Picker = { r: number; c: number; x: number; y: number; openLeft: boolean };

// Widest the recorder can get (matches .picker max-width) — used to decide
// whether it would overflow the right edge and should flip left instead.
const PICKER_MAX_WIDTH = 280;

// Gopher Mode (dev-only) overlay on a recorded cell. "initial" = the first
// gopher (🐁); "revealed" = a gopher uncovered by another (🐀) — both also
// record dug=0 so the solver treats the cell as revealed-empty. "hit" flags a
// gopher-revealed dig (🟨 cracked rock / 🧀 emptied soil / item keycap), all
// rendered on a yellow background. The underlying DigCode in `dug` is what
// feeds the calculator; this map is purely cosmetic + the export payload.
type GopherKind = "initial" | "revealed" | "hit";

// Dev-only: POST an export payload to the dev server's capture endpoint, which
// writes it to captures/ on disk (see vite.config.ts). Returns a status string
// for the UI. Only ever called from import.meta.env.DEV-gated handlers, so the
// fetch is tree-shaken out of the production static build.
async function saveCapture(kind: string, data: unknown): Promise<string> {
  try {
    const res = await fetch("/__capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, data }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const { file } = await res.json();
    return `💾 Saved to ${file}`;
  } catch {
    return "⚠️ Save failed — is the dev server running?";
  }
}

// Dev-only About sidebar. The component is excluded from the production
// single-file build (its only caller is guarded by import.meta.env.DEV, so Vite
// drops it). Its rich text styles stay inline; only the structural sidebar/scoot
// rules live in App.css (`.about-sidebar`, `body.about-open`) since they need
// fixed positioning + the body class — a few unused rules ship to prod, as the
// stylesheet already does regardless.
const ABOUT_LINK: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--code-bg)",
  color: "var(--text-h)",
  borderRadius: 6,
  padding: "4px 12px",
  fontSize: "0.85rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const ABOUT_HEAD: React.CSSProperties = { fontSize: "1.3rem", margin: 0, color: "var(--text-h)" };
const ABOUT_SECTION: React.CSSProperties = { margin: "0 0 22px" };
const ABOUT_H2: React.CSSProperties = {
  fontSize: "1.1rem",
  margin: "0 0 6px",
  color: "var(--text-h)",
};
const ABOUT_P: React.CSSProperties = { margin: 0, color: "var(--text)", lineHeight: 1.6 };
const ABOUT_LIST: React.CSSProperties = {
  margin: 0,
  paddingLeft: "1.2rem",
  color: "var(--text)",
  lineHeight: 1.7,
};

function About({ onClose }: { onClose: () => void }) {
  return (
    <aside className="about-sidebar" aria-label="About Treasures Dig Optimizer">
      <div className="about-head">
        <h2 style={ABOUT_HEAD}>About</h2>
        <button className="about-link" style={ABOUT_LINK} onClick={onClose} aria-label="Close about">
          ✕
        </button>
      </div>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Purpose</h2>
        <p style={ABOUT_P}>
          Treasures Dig Optimizer is a helper for the Monopoly GO treasure-map
          mini games. It optimizes hammer (shovel) usage so each dig reveals as
          much as possible, helping players uncover every item with fewer
          hammers and progress further through the mini-game levels.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Overview</h2>
        <p style={ABOUT_P}>
          You recreate the level's grid and declare which items are hidden on
          it. The app then ranks every cell by how likely an undiscovered item
          covers it, normalized by the hammer cost of digging it, and highlights
          the best cells to dig first. As you record what each dig reveals, the
          recommendations update live until every item is located.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Mechanism</h2>
        <p style={ABOUT_P}>
          For each remaining item — expanded by count and considering both
          orientations — the solver enumerates every valid placement on the
          grid. Each placement contributes a normalized weight to the cells it
          covers, and the aggregate is divided by the cell's hammer cost (rock
          costs two hammers, soil one). Cells with the highest cost-normalized
          score are the best first digs. Recording a result eliminates the
          placements it rules out and recomputes the scores against what remains.
        </p>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Coming Soon</h2>
        <ul style={ABOUT_LIST}>
          <li>
            <b>Mini game</b> — a playable treasure-dig game built into the app.
          </li>
          <li>
            <b>Calculations</b> — a detailed breakdown of the per-cell
            probability and hammer-cost figures behind each recommendation.
          </li>
          <li>
            <b>Tutorial</b> — a guided walkthrough of how to use the optimizer.
          </li>
        </ul>
      </section>

      <section style={ABOUT_SECTION}>
        <h2 style={ABOUT_H2}>Privacy</h2>
        <p style={ABOUT_P}>
          All state — theme, saved maps, and the active session — is stored
          locally in your browser. There are no cookies, no analytics, and no
          network requests; nothing leaves your device.
        </p>
      </section>
    </aside>
  );
}

function App() {
  const [grid, setGrid] = useState<number[][]>(emptyGrid);
  const [counts, setCounts] = useState<number[]>(() => ITEM_TYPES.map(() => 0));
  const [result, setResult] = useState<Evaluation | null>(null);
  // "Keep map, reset items" mode: the solved map and all recorded digs stay
  // frozen on screen while the item panel reverts to the count steppers, so the
  // player can re-pick the inventory and recalculate from the same board.
  const [repick, setRepick] = useState(false);
  // Inventory snapshot taken when re-pick begins, so the found pieces' shapes
  // survive while `counts` is zeroed for declaring the still-hidden pieces.
  const [repickBase, setRepickBase] = useState<{ long: number; short: number }[]>([]);
  // What the player has recorded at each dug cell. "r,c" → DigCode.
  const [dug, setDug] = useState<Map<string, DigCode>>(() => new Map());
  // Selected piece-part glyph per cell (set via right-click). "r,c" → glyph.
  const [parts, setParts] = useState<Map<string, string>>(() => new Map());
  // Gopher Mode (dev-only) overlay per cell. "r,c" → GopherKind. Gopher
  // controls are always available in dev — no toggle.
  const [gophers, setGophers] = useState<Map<string, GopherKind>>(() => new Map());
  // Transient status line for the map-state export.
  const [mapStateStatus, setMapStateStatus] = useState("");
  // Click history so Undo can restore a cell's prior dig + part (incl. hammer).
  const [history, setHistory] = useState<
    {
      key: string;
      prevDug: DigCode | undefined;
      prevPart: string | undefined;
      prevGopher: GopherKind | undefined;
    }[]
  >([]);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pickerItem, setPickerItem] = useState<number | null>(null);
  // Dev-only: when set, the next item placed via the recorder is tagged as a
  // gopher reveal ("hit") — its keycap renders on the yellow gopher background.
  const [pickerGopher, setPickerGopher] = useState(false);
  const [theme, setTheme] = useTheme();
  // About panel (dev-only) — a right-hand sidebar that scoots the app over on
  // wide screens and covers it on narrow ones, rather than replacing the view.
  const [aboutOpen, setAboutOpen] = useState(false);
  const [error, setError] = useState("");
  // Saved-map retention: persisted terrain, the carousel, and the save/load
  // status line all live in the feature hook.
  const saved = useSavedMaps();
  // Dev-only feedback for the "save saved maps to server" export (separate from
  // saved.status, which carries the always-on save/load feedback line).
  const [savedExportStatus, setSavedExportStatus] = useState("");

  // Click-and-drag soil painting (input mode): drag from the start cell to the
  // current cell to fill that rectangle with soil. `dragged` suppresses the
  // click-cycle a drag would otherwise trigger; `baseGrid` is the grid snapshot
  // at drag start so each move re-fills from a clean base (rectangle, not trail).
  const painting = useRef(false);
  const dragged = useRef(false);
  const dragStart = useRef<[number, number] | null>(null);
  const baseGrid = useRef<number[][] | null>(null);
  // What the drag paints: the next state in the click cycle from the start
  // cell (wall→soil→rock→wall), so a drag steps the whole rectangle one stage.
  const fillValue = useRef(1);
  // Live size readout for the current drag-rectangle, shown by the cursor once
  // any side exceeds 4. Null when not dragging (or while the rect is small).
  // `transform` places it in the quadrant opposite the drag so the mouse pointer
  // never covers it.
  const [dragSize, setDragSize] = useState<
    { w: number; h: number; x: number; y: number; transform: string } | null
  >(null);

  // Scoot the page over (CSS `body.about-open`) while the About sidebar is open;
  // on narrow screens the sidebar is full-width, so the app is pushed off-view.
  useEffect(() => {
    document.body.classList.toggle("about-open", aboutOpen);
    return () => document.body.classList.remove("about-open");
  }, [aboutOpen]);

  // End any drag-paint when the mouse is released. `mouseup` covers releases
  // over the document; the `mousemove` no-buttons check catches a release that
  // happened off-window (where no mouseup ever reaches us) the moment the cursor
  // returns; `blur` covers losing the window entirely.
  useEffect(() => {
    const stop = () => {
      painting.current = false;
      setDragSize(null);
    };
    const onMove = (e: MouseEvent) => {
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

  const total = counts.reduce((a, b) => a + b, 0);
  const locked = result !== null;
  // The item panel shows the count steppers during initial input and while
  // re-picking; the map stays locked during a re-pick so its dig state is kept.
  const inputMode = !locked || repick;

  // One entry per individual hidden item, in numbered order.
  const expandedItems = useMemo(
    () => ITEM_TYPES.flatMap((t, i) => Array.from({ length: counts[i] }, () => t)),
    [counts],
  );

  // Items recorded somewhere on the map (auto-found).
  const foundSet = useMemo(() => {
    const s = new Set<number>();
    for (const v of dug.values()) if (typeof v === "number" && v >= 1) s.add(v);
    return s;
  }, [dug]);

  // Kept found pieces shown (read-only) while re-picking — distinct recorded
  // item codes resolved against the pre-zeroed inventory snapshot.
  const repickFound = useMemo(() => {
    if (!repick) return [];
    const codes = [...new Set(dug.values())]
      .filter((v): v is number => typeof v === "number" && v >= 1)
      .sort((a, b) => a - b);
    return codes.map((code) => ({
      code,
      dims: repickBase[code - 1],
      located: result?.located.has(code) ?? false,
    }));
  }, [repick, dug, repickBase, result]);

  // Each recorded item's occupied cells — computed once, reused by the recorder
  // when filtering feasible parts for every candidate item.
  const footprints = useMemo(
    () => recordedFootprints(grid, dug, parts, expandedItems),
    [grid, dug, parts, expandedItems],
  );

  function cycleCell(r: number, c: number) {
    if (locked) return;
    setGrid((g) =>
      g.map((row, ri) =>
        ri === r ? row.map((v, ci) => (ci === c ? (v + 1) % 3 : v)) : row,
      ),
    );
  }

  // Input mode: mouse-down begins a potential drag, snapshotting the grid so the
  // rectangle re-fills from a clean base on every move. A pure click (no drag)
  // falls through to cycleCell.
  function paintDown(e: React.MouseEvent, r: number, c: number) {
    if (locked) return;
    e.preventDefault();
    painting.current = true;
    dragged.current = false;
    dragStart.current = [r, c];
    baseGrid.current = grid.map((row) => [...row]);
    fillValue.current = (grid[r][c] + 1) % 3; // wall→soil→rock→wall, matching click cycle
    setDragSize(null);
  }

  // Fill the rectangle spanned by the drag-start cell and (r,c) — with soil if
  // the drag began on a wall, or wall if it began on a diggable cell. Applied
  // over the start-of-drag snapshot so the shape is always a rectangle.
  function paintEnter(e: React.MouseEvent, r: number, c: number) {
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

  function changeCount(i: number, delta: number) {
    if (locked && !repick) return; // editable during input and re-pick
    // Kept found pieces already consume slots during re-pick — count them
    // toward the 10-item cap so found + declared-hidden never exceeds it.
    const base = repick ? repickFound.length : 0;
    setCounts((cs) => {
      const next = Math.max(0, cs[i] + delta);
      const othersTotal = cs.reduce((a, b, ix) => (ix === i ? a : a + b), 0);
      if (base + othersTotal + next > 10) return cs; // total capped at 10
      return cs.map((v, ix) => (ix === i ? next : v));
    });
  }

  function recompute(
    dugMap: Map<string, DigCode>,
    partsMap: Map<string, string>,
    gopherMap: Map<string, GopherKind> = gophers,
  ) {
    setResult(evaluate(grid, dugMap, partsMap, expandedItems, new Set(gopherMap.keys())));
  }

  // Apply a cell change (dig + part + gopher overlay), push the prior state to
  // history, recompute. An undefined value clears that field — so the ordinary
  // recorder actions wipe any stale gopher tag; gopher actions pass a kind.
  function commit(
    key: string,
    dugVal: DigCode | undefined,
    glyph: string | undefined,
    gopher?: GopherKind,
  ) {
    const nextDug = withEntry(dug, key, dugVal);
    const nextParts = withEntry(parts, key, glyph);
    const nextGophers = withEntry(gophers, key, gopher);
    setHistory((h) => [
      ...h,
      { key, prevDug: dug.get(key), prevPart: parts.get(key), prevGopher: gophers.get(key) },
    ]);
    setDug(nextDug);
    setParts(nextParts);
    setGophers(nextGophers);
    recompute(nextDug, nextParts, nextGophers);
  }

  // Clear all recorded digs/parts and recompute from the bare map + items.
  function startSession() {
    const freshDug = new Map<string, DigCode>();
    const freshParts = new Map<string, string>();
    setDug(freshDug);
    setParts(freshParts);
    setGophers(new Map());
    setMapStateStatus("");
    setHistory([]);
    closePicker();
    recompute(freshDug, freshParts, new Map());
  }

  // Return to the input phase (un-lock), clearing the session.
  function resetToInput() {
    setDug(new Map());
    setParts(new Map());
    setGophers(new Map());
    setMapStateStatus("");
    setHistory([]);
    setResult(null);
    setRepick(false);
    setError("");
    closePicker();
  }

  function submit() {
    // During re-pick the count is the *hidden* declaration only — 0 is valid
    // (every piece already found, just clearing a mis-declared one).
    if (!repick && total === 0) return setError("Add at least one item (count > 0).");
    setError("");
    saved.save(grid, true); // auto-save the map (silently) on Calculate
    if (repick) {
      // Re-pick: keep every found piece, re-index it into the new inventory
      // (found + newly-declared hidden), and re-solve against the kept digs.
      const { counts: nc, dug: nd, items } = remapRepick(repickBase, dug, counts, ITEM_TYPES);
      setCounts(nc);
      setDug(nd);
      setHistory([]); // undo can't cross the re-pick remap boundary
      setRepick(false);
      setResult(evaluate(grid, nd, parts, items, new Set(gophers.keys())));
    } else {
      startSession();
    }
  }

  // Left-click cycle. Plain cells: hammer → cracked-rock → 0️⃣, then the recorder
  // modal. Cells the solver has marked carry richer behaviour:
  //  • any 2-hit (circle, untouched rock) → crack it to the 1-hit square;
  //  • a confirmed/located 1-hit (green square) → dig it out, revealing its item
  //    keycap (recorded with the matching footprint glyph);
  //  • a forced 1-hit (purple square) → open the modal to pick which item;
  //  • a tentative (orange) square keeps the plain cycle.
  function cycleDig(e: React.MouseEvent, r: number, c: number) {
    if (repick) return; // map is frozen while re-picking items
    const terrain = grid[r][c];
    if (terrain === 0) return; // can't dig a wall
    const key = cellKey(r, c);
    const code = dug.get(key);
    if (code === 0 || (typeof code === "number" && code >= 1)) {
      openPicker(e, r, c);
      return;
    }
    // Any untouched rock (2-hit "circle") just cracks to its 1-hit "square",
    // keeping whatever overlay it carries (green/orange/purple).
    if (terrain === 2 && code === undefined) {
      commit(key, "cracked", undefined);
      return;
    }
    // Now a 1-hit square (soil, or already-cracked rock).
    const cc = result?.confirmed[r]?.[c];
    if (cc?.confirmed) {
      const item = cc.confirmedItem;
      // Located item → reveal its keycap, recorded with the footprint glyph so
      // the placement stays pinned. Still-ambiguous → let the player choose.
      if (item != null && (result?.located.has(item) ?? false)) {
        const dims = expandedItems[item - 1];
        const glyph = partGlyphForFootprint(r, c, footprints.get(item) ?? [], dims.long, dims.short);
        recordCell(r, c, item, glyph);
        return;
      }
      openPicker(e, r, c);
      return;
    }
    // Guaranteed item cell, owner unknown (purple square) → pick which item.
    if (result?.kind === "ok" && result.forced.has(key)) {
      openPicker(e, r, c);
      return;
    }
    commit(key, nextDigCode(code, terrain), undefined);
  }

  // Recorder actions: each sets one cell, clearing any prior part.
  const setEmpty = (r: number, c: number) => recordCell(r, c, 0);
  const setCracked = (r: number, c: number) => recordCell(r, c, "cracked");
  const applyPart = (r: number, c: number, itemIndex: number, glyph: string | undefined) =>
    recordCell(r, c, itemIndex, glyph, pickerGopher ? "hit" : undefined);

  // Gopher Mode actions (dev-only). A gopher hit reveals the cell: rock cracks
  // (🟨, 1 hit left), soil empties (🧀, dug=0). The gopher creatures (🐁/🐀)
  // occupy the cell, so they also record dug=0 (non-placeable for the solver).
  const logGopherHit = (r: number, c: number) =>
    grid[r][c] === 2
      ? recordCell(r, c, "cracked", undefined, "hit")
      : recordCell(r, c, 0, undefined, "hit");
  const logInitialGopher = (r: number, c: number) => recordCell(r, c, 0, undefined, "initial");
  const logRevealedGopher = (r: number, c: number) => recordCell(r, c, 0, undefined, "revealed");

  function recordCell(r: number, c: number, dugVal: DigCode, glyph?: string, gopher?: GopherKind) {
    commit(cellKey(r, c), dugVal, glyph, gopher);
    closePicker();
  }

  function clearCell(r: number, c: number) {
    const key = cellKey(r, c);
    if (dug.has(key) || parts.has(key)) commit(key, undefined, undefined);
    closePicker();
  }

  // Step back one click — restores the cell's prior dig + part state.
  function undo() {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const nextDug = withEntry(dug, last.key, last.prevDug);
    const nextParts = withEntry(parts, last.key, last.prevPart);
    const nextGophers = withEntry(gophers, last.key, last.prevGopher);
    setHistory((h) => h.slice(0, -1));
    setDug(nextDug);
    setParts(nextParts);
    setGophers(nextGophers);
    recompute(nextDug, nextParts, nextGophers);
  }

  function openPicker(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (!locked || repick || grid[r][c] === 0) return;
    // Flip leftward when the modal would run past the right edge of the viewport.
    const openLeft = e.clientX + PICKER_MAX_WIDTH > window.innerWidth;
    setPicker({ r, c, x: e.clientX, y: e.clientY, openLeft });
    setPickerItem(null);
    setPickerGopher(false);
  }

  function closePicker() {
    setPicker(null);
    setPickerItem(null);
    setPickerGopher(false);
  }

  // Clear the input map back to all walls and reset item counts to zero.
  function clearMap() {
    if (locked) return;
    setGrid(emptyGrid());
    setCounts(ITEM_TYPES.map(() => 0));
  }

  function newSession() {
    setGrid(emptyGrid());
    setCounts(ITEM_TYPES.map(() => 0));
    resetToInput();
  }

  // Recovery from an unsolvable state: keep the map AND every recorded dig, zero
  // the item counts, and swap the item panel to the count steppers so the player
  // can re-pick the inventory and recalculate from the same board. The map stays
  // locked/frozen throughout. (Clearing the map too is "New Map".)
  function resetItems() {
    setRepickBase(expandedItems); // remember found pieces' shapes before zeroing
    setCounts(ITEM_TYPES.map(() => 0)); // steppers now declare hidden pieces
    setError("");
    setRepick(true);
    closePicker();
  }

  // Load a saved map's terrain only — no session, no item count. The shape is
  // re-centred on the grid (nicer than wherever it happened to be drawn). Stays
  // in input mode so the user can adjust the map and add items. Wires the
  // saved-maps → session seam the feature hook intentionally doesn't own.
  function loadSavedMap(m: number[][]) {
    setGrid(centerGrid(m));
    resetToInput();
    saved.setStatus("");
  }

  // Dev-only: write all saved maps (terrain grids) to captures/ on disk via the
  // dev server, as a portable backup of the saved-maps localStorage entry.
  async function exportSavedMaps() {
    setSavedExportStatus(await saveCapture("saved-maps", saved.maps));
  }

  // Dev-only: serialize the current map + full recorded state (incl. the gopher
  // overlay) exactly as it stands and write it to captures/ on disk via the dev
  // server, for integration back into the app. Maps go out as [key, value] pairs
  // (rebuildable with new Map(...)).
  async function exportMapState() {
    const payload = {
      grid,
      counts,
      dug: [...dug],
      parts: [...parts],
      gophers: [...gophers],
    };
    setMapStateStatus(await saveCapture("map-state", payload));
  }

  const recommended = result?.kind === "ok" ? result.top : null;
  const eliminated = result?.kind === "ok" ? result.eliminated : null;
  const forced = result?.kind === "ok" ? result.forced : null;
  const forcedItem = result?.kind === "ok" ? result.forcedItem : null;

  // Full grid while building; cropped to the used region once committed.
  const box = locked ? boundingBox(grid) : { r0: 0, r1: SIZE - 1, c0: 0, c1: SIZE - 1 };
  const rows = range(box.r0, box.r1);
  const cols = range(box.c0, box.c1);

  return (
    <main className="app">
      <div className="header-bar">
        <h1>Treasures Dig Optimizer</h1>
      </div>

      {/* About sidebar (dev-only) — Vite tree-shakes it out of the production
          single-file build, where only the solver ships. */}
      {import.meta.env.DEV && aboutOpen && <About onClose={() => setAboutOpen(false)} />}

      <ThemeSwitcher theme={theme} onChange={setTheme} />

      <div className="layout">
        <section>
          <h2>{locked ? "Map" : "Input Map"}</h2>

          {!locked && (
            <p className="hint">
              Cells start as wall. Click to cycle <b>dig → rock → wall</b> (tan = dig, 🪨 = rock, dark = wall).
              <br />
              Click and drag to make rectangle inputs.
            </p>
          )}
          <div
            className="grid"
            role="grid"
            aria-label="map"
            style={{ gridTemplateColumns: `repeat(${cols.length}, 40px)` }}
          >
            {rows.map((r) =>
              cols.map((c) => {
                const v = grid[r][c];
                const key = cellKey(r, c);
                const code = dug.get(key);
                const gopher = gophers.get(key); // dev-only gopher overlay
                const cc = result?.confirmed[r]?.[c]; // structured cell from evaluate
                const isEmpty = code === 0;
                const isItem = typeof code === "number" && code >= 1;
                const isCracked = code === "cracked";
                const isConfirmed = !isItem && !!cc?.confirmed;
                // Cell guaranteed to hold an item (every arrangement covers it).
                const isForced = !isItem && !isEmpty && !isConfirmed && (forced?.has(key) ?? false);
                // …and, when the solver can deduce which item type, the owning
                // item index (so it shows that item's colour, not purple).
                const deducedItem = isForced ? forcedItem?.get(key) : undefined;
                const isForcedUnknown = isForced && deducedItem == null; // → purple
                // Covered by some-but-not-all candidate footprints of an
                // unresolved item — a possible edge, reserved but not certain.
                const isTentative = !isItem && !isConfirmed && !isForced && !!cc?.tentative;
                const isDug = isEmpty || isItem;
                const isEliminated =
                  !isDug && !isConfirmed && !isForced && !isTentative && (eliminated?.has(key) ?? false);
                const isRec =
                  !isDug && !isConfirmed && !isForced && !isTentative && !isEliminated && (recommended?.has(key) ?? false);
                // The known item owning this cell: a recorded dig, a confirmed
                // footprint cell, or a deduced forced cell. Drives the per-item ring.
                const knownItem = isItem
                  ? (code as number)
                  : isConfirmed
                    ? cc?.confirmedItem
                    : deducedItem;
                const ringColor =
                  knownItem != null ? itemColor(knownItem) : isForcedUnknown ? FORCED_COLOR : undefined;
                const cls =
                  `cell terrain-${v}` +
                  (isRec ? " rec" : "") +
                  (isDug ? " dug" : "") +
                  (knownItem != null ? " item-known" : "") +
                  (isForcedUnknown ? " forced" : "") +
                  (isTentative ? " tentative" : "") +
                  (isEliminated ? " eliminated" : "") +
                  (gopher ? " gopher" : "") + // dev-only yellow background
                  (locked && v === 0 ? " nodig" : ""); // wall in result mode — not diggable
                // A per-item ring (inline so the colour count stays dynamic)
                // overrides the class box-shadows for known-item / forced cells.
                const style = ringColor ? { boxShadow: ringShadow(ringColor) } : undefined;
                // Highest-priority state wins, mirroring the class precedence above.
                const content = (() => {
                  // Gopher overlay glyphs take precedence over the dig glyph.
                  if (gopher === "initial") return "🐁";
                  if (gopher === "revealed") return "🐀";
                  if (gopher === "hit") {
                    if (isCracked) return "🪤"; // rock cracked by gopher
                    if (isEmpty) return "🧀"; // soil emptied by gopher
                    // item revealed by gopher falls through to the keycap below
                  }
                  if (isEmpty) return "0️⃣";
                  if (isItem) return KEYCAPS[(code as number) - 1] ?? `${code}`;
                  // Known item's undug footprint cell — confirmed (recorded) or a
                  // deduced forced cell. Green hit-count emoji (🟢 = 2, 🟩 = 1);
                  // the per-item colour ring carries which item it is.
                  if (isConfirmed || deducedItem != null)
                    return (cc?.hitsRemaining ?? 0) >= 2 ? "🟢" : "🟩";
                  // 🟣 = 2 hits (untouched rock), 🟪 = 1 hit (soil/cracked) —
                  // guaranteed item cell, owning item not yet determined.
                  if (isForcedUnknown) return v === 2 && !isCracked ? "🟣" : "🟪";
                  // 🟠 = 2 hits left (untouched rock), 🟧 = 1 hit (soil or
                  // cracked rock) — a possible but unconfirmed item edge.
                  // Shape matches confirmed/eliminated rows: square = 1 hit,
                  // circle = 2 hits.
                  if (isTentative) return v === 2 && !isCracked ? "🟠" : "🟧";
                  // 🔴 = 2 hits left (untouched rock), 🟥 = 1 hit (soil or
                  // cracked rock) — no remaining item can cover this cell
                  if (isEliminated) return v === 2 && !isCracked ? "🔴" : "🟥";
                  if (isRec) return isCracked ? "⛏️" : DIG_GLYPH[v]; // hammer only when recommended
                  if (isCracked) return ""; // rock already broken, not recommended — no glyph
                  return TERRAIN_GLYPH[v];
                })();
                return (
                  <button
                    key={key}
                    className={cls}
                    style={style}
                    onMouseDown={(e) => paintDown(e, r, c)}
                    onMouseEnter={(e) => paintEnter(e, r, c)}
                    onClick={(e) => (locked ? cycleDig(e, r, c) : cellClick(r, c))}
                    onContextMenu={(e) => openPicker(e, r, c)}
                    aria-label={key}
                  >
                    {content}
                  </button>
                );
              }),
            )}
          </div>

          {locked && (
            <div className="map-legend" aria-label="map legend">
              {MAP_LEGEND.map(({ icon, label }) => (
                <div key={label} className="legend-item">
                  <span className="legend-icon" aria-hidden="true">{icon}</span>
                  <span className="legend-sep" aria-hidden="true">•</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {!locked && (
            <>
              <div className="map-actions">
                <button onClick={clearMap}>Reset map</button>
                <button onClick={() => saved.save(grid)}>Save map</button>
              </div>
              {saved.status && <p className="hint save-status">{saved.status}</p>}
            </>
          )}

          {/* Saved maps: click a card to load its terrain only (no session, no
              item count). Renders nothing when there are none saved. */}
          {!locked && (
            <SavedMaps
              maps={saved.maps}
              cardsRef={saved.cardsRef}
              cardEnds={saved.cardEnds}
              onScroll={saved.updateCardEnds}
              onScrollBy={saved.scrollBy}
              onDelete={saved.remove}
              onLoad={loadSavedMap}
              footerSlot={
                // Dev-only: write the saved maps to captures/ on disk. Dropped
                // from production builds via the DEV guard. Moves to dev/ later.
                import.meta.env.DEV ? (
                  <div className="saved-maps-actions">
                    <button onClick={exportSavedMaps}>💾 Export saved maps</button>
                    {savedExportStatus && <span className="hint">{savedExportStatus}</span>}
                  </div>
                ) : undefined
              }
            />
          )}
        </section>

        <section className="panel">
          <h2>{inputMode ? "Input Item Table" : "Item Table"}</h2>

          {repick && (
            <>
              <p className="hint">
                Your map, digs, and found items are kept. Declare the still-hidden
                pieces below, then recalculate.
              </p>
              {repickFound.length > 0 && (
                <table className="items">
                  <thead>
                    <tr>
                      <th>Found (kept)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repickFound.map(({ code, dims, located }) => (
                      <tr key={code} className="is-found">
                        <td style={{ borderLeft: `5px solid ${itemColor(code)}` }}>
                          <span className="item-swatch" style={{ background: itemColor(code) }} />
                          {KEYCAPS[code - 1] ?? `${code}.`}{" "}
                          {dims ? `${dims.long}×${dims.short}` : "?"}
                        </td>
                        <td>
                          {located ? (
                            <>
                              <span className="item-swatch" style={{ background: itemColor(code) }} />
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
              )}
              <p className="hint">Declare hidden pieces to add:</p>
            </>
          )}
          {!locked && (
            <p className="hint">Set item counts.</p>
          )}
          {inputMode && (
            <>
              {/* Two columns keep the thin (1×n) and wide (2×n, 3×3) items apart
                  so 1×2 / 2×2 (etc.) can't be misclicked for one another. */}
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
                            <button
                              onClick={() => changeCount(i, -1)}
                              aria-label={`decrease ${t.label}`}
                            >
                              −
                            </button>
                            <span className="count">{counts[i]}</span>
                            <button
                              onClick={() => changeCount(i, +1)}
                              disabled={(repick ? repickFound.length : 0) + total >= 10}
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

              {(repick ? repickFound.length : 0) + total >= 10 && (
                <p className="hint">Maximum of 10 items reached.</p>
              )}
              <button className="primary" onClick={submit}>
                {repick ? "Recalculate" : "Calculate!"}
              </button>
              {error && <p className="error">{error}</p>}
            </>
          )}

          {locked && !repick && (
            <>
              {result?.kind === "ok" && result.solved && (
                <div className="result-head centered">
                  <p>
                    Solved! 🎯 Dig out the
                    coloured cells - <b>{result.hammersRemaining}</b> hammer
                    {result.hammersRemaining === 1 ? "" : "s"} needed for completion.
                  </p>
                </div>
              )}
              {result?.kind === "ok" && !result.solved && (
                <div className="result-head">
                  <p>
                    <b>Left-click</b> a cell to log hits:
                    ⚒️→⛏️→0️⃣.
                  </p>
                  <p>
                    <b>Right-click</b> a cell to open the item selector. Select to place an item or reset the cell. The remainder of the item will populate automatically.
                  </p>
                </div>
              )}
              {result?.kind === "complete" && (
                <div className="result-head centered">
                  {result.hammersRemaining >= 0 ? (
                    <p>
                      All items located. 🎉 <b>{result.hammersRemaining}</b> more hammer
                      {result.hammersRemaining === 1 ? "" : "s"} to complete the map.
                    </p>
                  ) : (
                    <p>Every treasure dug out — map complete.</p>
                  )}
                </div>
              )}
              {result?.kind === "unsolvable" && (
                <div className="result-head reset-items centered">
                  <p className="error">⚠️ We can't solve this — did you record the items correctly?</p>
                  <div className="actions">
                    <button className="primary" onClick={resetItems}>
                      Keep map, reset items
                    </button>
                    <button className="primary" onClick={newSession}>
                      Reset map and items
                    </button>
                  </div>
                </div>
              )}

              <table className="items">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Found</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedItems.map((t, i) => {
                    const isFound = foundSet.has(i + 1);
                    const isLocated = result?.located.has(i + 1) ?? false;
                    // Found OR deduced-located rows carry their item colour — a
                    // swatch plus a thick left accent — to match the map rings.
                    const coloured = isFound || isLocated;
                    const rowStyle = coloured
                      ? { borderLeft: `5px solid ${itemColor(i + 1)}` }
                      : undefined;
                    return (
                      <tr key={i} className={coloured ? "is-found" : ""}>
                        <td style={rowStyle}>
                          {coloured && (
                            <span className="item-swatch" style={{ background: itemColor(i + 1) }} />
                          )}
                          {KEYCAPS[i] ?? `${i + 1}.`} {t.label}
                        </td>
                        <td>
                          {isLocated ? (
                            <>
                              <span className="item-swatch" style={{ background: itemColor(i + 1) }} />
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

              <div className="actions">
                <button
                  className="primary"
                  onClick={undo}
                  disabled={history.length === 0}
                >
                  ↩️ Undo
                </button>
                <button
                  className="primary"
                  onClick={startSession}
                  disabled={history.length === 0}
                >
                  Reset
                </button>
                <button className="primary" onClick={newSession}>
                  New Map
                </button>
              </div>

              {/* Gopher Mode is a dev capture tool — always on in dev, dropped
                  from production (pure-HTML) builds; Vite tree-shakes the dead
                  branch. */}
              {import.meta.env.DEV && (
                <div className="actions gopher-actions">
                  <button className="primary" onClick={exportMapState}>
                    💾 Save map state
                  </button>
                  {mapStateStatus && <span className="hint">{mapStateStatus}</span>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {picker && (
        <div
          className="picker-backdrop"
          onClick={closePicker}
          onContextMenu={(e) => {
            e.preventDefault();
            closePicker();
          }}
        >
          <div
            className="picker"
            style={{
              left: picker.x,
              top: picker.y,
              // grow leftward from the anchor when flipped (keeps it on-screen)
              transform: picker.openLeft ? "translateX(-100%)" : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {pickerItem === null ? (
              <>
                <p className="picker-title">
                  {pickerGopher ? "🟨 Record gopher-revealed item" : "Record found item here"}
                </p>
                <div className="picker-grid">
                  {expandedItems.map((t, i) => {
                    const already = dug.get(cellKey(picker.r, picker.c)) === i + 1;
                    // In gopher "Revealed item" mode the gopher has proven an item
                    // is here, so it overrides the solver: every item stays
                    // selectable — even one already located elsewhere (the reveal
                    // is ground truth) and even where no normal placement fits.
                    // Outside gopher mode, hide a fully-pinned (located) item — it
                    // can't also be here — and any item with no feasible placement
                    // at this cell. A found-but-still-ambiguous item stays
                    // selectable so the player can record another piece.
                    if (!pickerGopher) {
                      const isLocated = result?.located.has(i + 1) ?? false;
                      if (isLocated && !already) return null;
                      const opts = feasibleGlyphs(
                        grid, dug, expandedItems, footprints, picker.r, picker.c, i + 1,
                      );
                      if (opts.size === 0) return null;
                    }
                    return (
                      <button
                        key={i}
                        onClick={() =>
                          t.long === 1 && t.short === 1
                            ? applyPart(picker.r, picker.c, i + 1, undefined)
                            : setPickerItem(i + 1)
                        }
                      >
                        {KEYCAPS[i]} {t.label}
                      </button>
                    );
                  })}
                </div>
                <div className="picker-foot">
                  <button onClick={() => setEmpty(picker.r, picker.c)}>Empty 0️⃣</button>
                  {grid[picker.r][picker.c] === 2 && (
                    <button onClick={() => setCracked(picker.r, picker.c)}>🪨 Rock</button>
                  )}
                  <button onClick={() => clearCell(picker.r, picker.c)}>⛏️ Hammer</button>
                  <button onClick={closePicker}>Cancel</button>
                </div>
                {import.meta.env.DEV && (
                  <div className="picker-foot gopher-foot">
                    <button onClick={() => logInitialGopher(picker.r, picker.c)}>🐁 Initial gopher</button>
                    <button onClick={() => logRevealedGopher(picker.r, picker.c)}>🐀 Revealed gopher</button>
                    <button
                      className={pickerGopher ? "active" : ""}
                      aria-pressed={pickerGopher}
                      onClick={() => setPickerGopher((g) => !g)}
                    >
                      🟨 Revealed item{pickerGopher ? " ✓" : ""}
                    </button>
                    <button onClick={() => logGopherHit(picker.r, picker.c)}>
                      {grid[picker.r][picker.c] === 2 ? "🪤 Gopher crack" : "🧀 Gopher empty"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="picker-title">
                  {KEYCAPS[pickerItem - 1]} {expandedItems[pickerItem - 1].label} — which part?
                </p>
                {(() => {
                  const dims = expandedItems[pickerItem - 1];
                  // Gopher mode allows any part (the reveal is ground truth);
                  // otherwise restrict to parts whose footprint actually fits.
                  const feasible = pickerGopher
                    ? null
                    : feasibleGlyphs(
                      grid, dug, expandedItems, footprints, picker.r, picker.c, pickerItem,
                    );
                  return (
                    <div className="picker-parts">
                      {partLayout(dims.long, dims.short).flatMap((row, ri) =>
                        row.map((glyph, ci) =>
                          !feasible || feasible.has(glyph) ? (
                            <button
                              key={`${ri}-${ci}`}
                              className="part-cell"
                              onClick={() =>
                                applyPart(picker.r, picker.c, pickerItem, glyph)
                              }
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
                  <button onClick={() => setPickerItem(null)}>← Back</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Drag-rectangle size readout — only once a side exceeds 4 cells. */}
      {dragSize && (dragSize.w > 4 || dragSize.h > 4) && (
        <div
          className="drag-size"
          style={{ left: dragSize.x, top: dragSize.y, transform: dragSize.transform }}
        >
          {dragSize.w}×{dragSize.h}
        </div>
      )}

      <footer className="credits">
        {/* About toggle lives here (dev-only); hidden while the sidebar is open.
            Styled inline so nothing About-specific ships to the prod build. */}
        {import.meta.env.DEV && !aboutOpen && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <button className="about-link" style={ABOUT_LINK} onClick={() => setAboutOpen(true)}>
              About
            </button>
          </div>
        )}
        <p className="credits-title">Sources</p>
        <p className="credits-note">
          The dig-optimization approach was informed by these battleship probability solvers:
        </p>
        <ul className="credits-list">
          <li>
            <a href="https://cliambrown.com/battleship/" target="_blank" rel="noreferrer noopener">
              C. Liam Brown — Battleship Probability Calculator
            </a>{" "}
            (<a href="https://cliambrown.com/battleship/methodology.php" target="_blank" rel="noreferrer noopener">methodology</a>)
          </li>
          <li>
            <a href="https://www.noq.solutions/battleship" target="_blank" rel="noreferrer noopener">
              Noq — Battleship solver
            </a>
          </li>
          <li>
            <a href="https://nulliq.dev/posts/battleship/" target="_blank" rel="noreferrer noopener">
              nulliq — Battleship
            </a>
          </li>
        </ul>
      </footer>
    </main>
  );
}

export default App;
