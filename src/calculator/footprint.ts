import type { Cell } from "./cell-state";

// A part glyph encodes where, within an item's bounding rectangle, the recorded
// cell sits. Combined with the item's dimensions that pins the full footprint —
// the set of cells the item occupies — which the recompute paints confirmed 🟩.

type Pos = "start" | "mid" | "end";

// Box-drawing parts (2-wide and wider): vertical + horizontal position.
const BOX_GLYPH: Record<string, { v: Pos; h: Pos }> = {
  "╔": { v: "start", h: "start" },
  "╦": { v: "start", h: "mid" },
  "╗": { v: "start", h: "end" },
  "╠": { v: "mid", h: "start" },
  "╬": { v: "mid", h: "mid" },
  "╣": { v: "mid", h: "end" },
  "╚": { v: "end", h: "start" },
  "╩": { v: "end", h: "mid" },
  "╝": { v: "end", h: "end" },
};

// 1-wide parts: end caps (arrow points away from the body) and axis middles.
const LINE_GLYPH: Record<string, { axis: "h" | "v"; pos: Pos }> = {
  "⬅️": { axis: "h", pos: "start" },
  "➡️": { axis: "h", pos: "end" },
  "↔": { axis: "h", pos: "mid" },
  "↔️": { axis: "h", pos: "mid" }, // emoji-presentation alias
  "⬆️": { axis: "v", pos: "start" },
  "⬇️": { axis: "v", pos: "end" },
  "↕": { axis: "v", pos: "mid" },
  "↕️": { axis: "v", pos: "mid" }, // emoji-presentation alias
};

// Forward glyph tables (position → glyph) — the inverse of BOX_GLYPH / LINE_GLYPH
// above. partGlyphForFootprint uses these to label a cell dug out of a located
// footprint with the matching part glyph. Forward and inverse must agree; the
// round-trip (footprint → glyph → inferFootprints back to the footprint) is
// asserted in footprint.test.ts so the two directions can't drift.
const LINE_H: Record<Pos, string> = { start: "⬅️", mid: "↔️", end: "➡️" };
const LINE_V: Record<Pos, string> = { start: "⬆️", mid: "↕️", end: "⬇️" };
const BOX_GLYPHS: Record<string, string> = {
  "start,start": "╔",
  "start,mid": "╦",
  "start,end": "╗",
  "mid,start": "╠",
  "mid,mid": "╬",
  "mid,end": "╣",
  "end,start": "╚",
  "end,mid": "╩",
  "end,end": "╝",
};

// The positional part glyph for cell (r,c) within a located item's footprint,
// given the footprint's occupied cell keys ("r,c") and the item's dims. A 1×1
// item has no part glyph. A 1-wide item reads its position along whichever axis
// the footprint spans; a multi-wide item reads both axes into a box glyph.
export function partGlyphForFootprint(
  r: number,
  c: number,
  cellKeys: string[],
  long: number,
  short: number,
): string | undefined {
  if (long === 1 && short === 1) return undefined;
  const cells = cellKeys.map((k) => k.split(",").map(Number));
  const rs = cells.map((x) => x[0]);
  const cs = cells.map((x) => x[1]);
  const r0 = Math.min(...rs),
    r1 = Math.max(...rs);
  const c0 = Math.min(...cs),
    c1 = Math.max(...cs);
  const at = (i: number, lo: number, hi: number): Pos =>
    i === lo ? "start" : i === hi ? "end" : "mid";
  if (short === 1) {
    return c1 > c0 ? LINE_H[at(c, c0, c1)] : LINE_V[at(r, r0, r1)];
  }
  return BOX_GLYPHS[`${at(r, r0, r1)},${at(c, c0, c1)}`];
}

export interface FootprintCell {
  row: number;
  col: number;
}

// A recorded part of an item: where the player marked it and which positional
// glyph they chose. Multiple parts of one item are intersected to pin it down.
export interface RecordedPart {
  row: number;
  col: number;
  glyph: string | undefined;
}

// Offsets of the part cell from a footprint's leading edge along a span of
// length `len` for a given position. "start"/"end" are unique. "mid" has no
// single centre on an even span: a length-4 item recorded at an internal cell
// could sit either way, so it yields TWO offsets (the ambiguity the confidence
// overlay resolves). A span < 3 has no internal cell at all → no offset, so a
// "mid" glyph is infeasible there (e.g. a 1×2, which is all end-caps).
function offsets(pos: Pos, len: number): number[] {
  if (pos === "start") return [0];
  if (pos === "end") return [len - 1];
  if (len < 3) return [];
  const lo = Math.floor((len - 1) / 2);
  const hi = Math.ceil((len - 1) / 2);
  return lo === hi ? [lo] : [lo, hi];
}

// Canonical signature for a footprint (order-independent), used to dedupe
// candidates and to intersect candidate sets across an item's recorded parts.
function sig(cells: FootprintCell[]): string {
  return cells
    .map(({ row, col }) => `${row},${col}`)
    .sort()
    .join("|");
}

function dedupe(list: FootprintCell[][]): FootprintCell[][] {
  const seen = new Set<string>();
  const out: FootprintCell[][] = [];
  for (const cells of list) {
    const s = sig(cells);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(cells);
    }
  }
  return out;
}

// Every footprint a single recorded part at (row,col) could belong to given the
// item's dims — each passing `fits` (bounds / walls / reveals). Usually one; a
// mid glyph on a length-4 axis yields two (the unresolved placement).
export function inferFootprints(
  glyph: string | undefined,
  row: number,
  col: number,
  long: number,
  short: number,
  fits: (cells: FootprintCell[]) => boolean,
): FootprintCell[][] {
  const out: FootprintCell[][] = [];
  const add = (cells: FootprintCell[]) => {
    if (fits(cells)) out.push(cells);
  };

  // 1×1 — the recorded cell is the whole item.
  if (long === 1 && short === 1) {
    add([{ row, col }]);
    return dedupe(out);
  }

  // 1-wide items — line glyphs along the long axis.
  if (short === 1 && glyph && glyph in LINE_GLYPH) {
    const { axis, pos } = LINE_GLYPH[glyph];
    for (const b of offsets(pos, long)) {
      const cells: FootprintCell[] = [];
      for (let i = 0; i < long; i++) {
        cells.push(axis === "h" ? { row, col: col - b + i } : { row: row - b + i, col });
      }
      add(cells);
    }
    return dedupe(out);
  }

  // Multi-wide items — box glyphs. Try both orientations; each axis contributes
  // its candidate offset(s), so a mid on an even axis fans out into both slots.
  if (glyph && glyph in BOX_GLYPH) {
    const { v, h } = BOX_GLYPH[glyph];
    for (const [height, width] of [
      [long, short],
      [short, long],
    ]) {
      for (const bv of offsets(v, height)) {
        for (const bh of offsets(h, width)) {
          const r0 = row - bv;
          const c0 = col - bh;
          const cells: FootprintCell[] = [];
          for (let dr = 0; dr < height; dr++) {
            for (let dc = 0; dc < width; dc++) {
              cells.push({ row: r0 + dr, col: c0 + dc });
            }
          }
          add(cells);
        }
      }
    }
    return dedupe(out);
  }

  return out;
}

// First feasible footprint for a part, or null — the single-footprint view used
// by occupancy/feasibility callers that only need "does any placement fit?".
export function inferFootprint(
  glyph: string | undefined,
  row: number,
  col: number,
  long: number,
  short: number,
  fits: (cells: FootprintCell[]) => boolean,
): FootprintCell[] | null {
  return inferFootprints(glyph, row, col, long, short, fits)[0] ?? null;
}

// Candidate footprints for an item given EVERY recorded part: the intersection
// (by footprint identity) of each part's own candidate set. One recorded part
// may leave the placement ambiguous (length-4 internal); a second consistent
// part typically collapses it to one.
export function itemFootprints(
  parts: RecordedPart[],
  long: number,
  short: number,
  fits: (cells: FootprintCell[]) => boolean,
): FootprintCell[][] {
  if (parts.length === 0) return [];
  let cands = inferFootprints(parts[0].glyph, parts[0].row, parts[0].col, long, short, fits);
  for (let k = 1; k < parts.length && cands.length > 0; k++) {
    const p = parts[k];
    const keep = new Set(inferFootprints(p.glyph, p.row, p.col, long, short, fits).map(sig));
    cands = cands.filter((f) => keep.has(sig(f)));
  }
  return cands;
}

// Walk a grid, gather each item's recorded parts, and return a clone with its
// footprint cells flagged. A cell in EVERY candidate footprint is confirmed (🟩
// — definitely the item); a cell in only some is tentative (🟠 — the unresolved
// edges of a length-4 internal find). An item with exactly one candidate is
// `located`; an ambiguous one stays found-but-unlocated until another recorded
// part collapses it. The recorded part cells keep their item glyph.
export function deriveConfirmedState(
  grid: Cell[][],
  dimsByIndex: Map<number, { long: number; short: number }>,
  // Cell keys ("r,c") that remain passable for footprint inference even when
  // recorded empty (dug=0) — a revealed-empty cell that may still host an item.
  // So an item's footprint may span such a cell here, where an ordinary
  // revealed-empty cell still blocks it. Scoped to this located-footprint
  // inference; the dig-recommendation solver keeps treating revealed cells as
  // non-placeable. The core does not interpret why a cell is passable.
  passable: Set<string> = new Set(),
): { grid: Cell[][]; located: Set<number> } {
  const out = grid.map((row) => row.map((cell) => ({ ...cell })));
  const rows = out.length;
  const cols = out[0]?.length ?? 0;

  const fits = (cells: FootprintCell[]) =>
    cells.every(
      ({ row, col }) =>
        row >= 0 &&
        col >= 0 &&
        row < rows &&
        col < cols &&
        out[row][col].terrain !== "wall" &&
        (!out[row][col].revealedEmpty || passable.has(`${row},${col}`)),
    );

  // Group every recorded part by its item index.
  const partsByItem = new Map<number, RecordedPart[]>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const item = out[r][c].item;
      if (!item) continue;
      const list = partsByItem.get(item.index) ?? [];
      list.push({ row: r, col: c, glyph: item.part });
      partsByItem.set(item.index, list);
    }
  }

  const located = new Set<number>();
  for (const [index, parts] of partsByItem) {
    const dims = dimsByIndex.get(index);
    if (!dims) continue;
    const candidates = itemFootprints(parts, dims.long, dims.short, fits);
    if (candidates.length === 0) continue;
    if (candidates.length === 1) located.add(index);

    // Count, per cell, how many candidate footprints cover it. Covered by all →
    // confident; covered by some → tentative.
    const cover = new Map<string, { row: number; col: number; n: number }>();
    for (const fp of candidates) {
      for (const { row, col } of fp) {
        const key = `${row},${col}`;
        const e = cover.get(key) ?? { row, col, n: 0 };
        e.n++;
        cover.set(key, e);
      }
    }
    for (const { row, col, n } of cover.values()) {
      const cell = out[row][col];
      if (cell.item) continue; // keep the recorded part glyph
      if (n === candidates.length) {
        cell.confirmed = true;
        // Covered by every candidate → certainly this item's cell, so tag the
        // owning index (even when the item isn't fully located yet) so the UI
        // can colour the footprint by item.
        cell.confirmedItem = index;
      } else cell.tentative = true;
    }
  }
  return { grid: out, located };
}
