// Joint multi-item placement reasoning.
//
// The original pipeline baked every recorded item into the grid (its footprint
// cells → non-placeable) and solved only the still-unfound items over what was
// left. That works while a found item's placement is unambiguous, but a found
// item whose footprint is still ambiguous (e.g. a corner glyph that fits two
// orientations) reserves the UNION of its candidate footprints — an over-
// reservation that can leave too few cells for the remaining items and report a
// solvable board as "unsolvable". It also can't tell apart two interchangeable
// same-type items, so neither ever locates.
//
// This module instead searches every still-unplaced item together — each found-
// but-ambiguous item constrained to its candidate footprints, each unfound item
// to all its valid placements — keeping their placements mutually exclusive. From
// that joint view it derives solvability, the guaranteed (forced) and impossible
// (eliminated) cells, and which items are pinned to a single region (located).

export interface PlacementUnit {
  index: number; // 1-based item index (drives located / forcedItem colouring)
  long: number;
  short: number;
  found: boolean; // recorded somewhere — its candidate set is already constrained
  // Flat cell indices (row * cols + col) the player actually recorded for this
  // item. A found unit's region is the candidate that contains these.
  recorded: number[];
  // Candidate placements, each a sorted list of flat cell indices.
  placements: number[][];
}

export interface JointTarget {
  flat: number;
  key: string; // "r,c"
}

export interface JointAnalysis {
  solvable: boolean;
  forced: Set<string>; // undug target cells covered by EVERY arrangement
  eliminated: Set<string>; // undug target cells covered by NO arrangement
  located: Set<number>; // item indices pinned to a single region
  forcedItem: Map<string, number>; // forced cell → owning item index, when known
  solvedRegion: boolean; // every target cell is forced or eliminated
}

// Fewest-options-first backtracking: can every item in `idxs` take one of its
// placements without overlapping `occupied` or each other? Short-circuits on the
// first complete arrangement. Mirrors elimination.ts's `placeable`, but over an
// explicit per-item placement list (so constrained found items slot in).
function canPlaceAll(pls: number[][][], idxs: number[], occupied: Set<number>): boolean {
  if (idxs.length === 0) return true;
  // Pick the most-constrained remaining item to branch on.
  let bi = 0;
  for (let j = 1; j < idxs.length; j++) {
    if (pls[idxs[j]].length < pls[idxs[bi]].length) bi = j;
  }
  const chosen = idxs[bi];
  const rest = idxs.filter((_, j) => j !== bi);
  for (const p of pls[chosen]) {
    if (p.some((k) => occupied.has(k))) continue;
    for (const k of p) occupied.add(k);
    const ok = canPlaceAll(pls, rest, occupied);
    for (const k of p) occupied.delete(k);
    if (ok) return true;
  }
  return false;
}

function sig(placement: number[]): string {
  return placement.join(",");
}

// Analyse the joint placement of every still-unplaced unit over the target
// cells. `cols` is the grid width (for flat ⇆ row/col). `targets` are the undug
// diggable cells eligible to be forced/eliminated.
export function analyzeArrangements(
  units: PlacementUnit[],
  targets: JointTarget[],
): JointAnalysis {
  const pls = units.map((u) => u.placements);
  const all = units.map((_, i) => i);

  const empty: JointAnalysis = {
    solvable: false,
    forced: new Set(),
    eliminated: new Set(),
    located: new Set(),
    forcedItem: new Map(),
    solvedRegion: false,
  };

  // No units to place: trivially solvable, nothing forced/eliminated.
  if (units.length === 0) return { ...empty, solvable: true, solvedRegion: targets.length === 0 };

  if (!canPlaceAll(pls, all, new Set())) return empty;

  // Live placements per unit: those extendable to a complete arrangement.
  const live: number[][] = units.map(() => []);
  for (let i = 0; i < units.length; i++) {
    const rest = all.filter((x) => x !== i);
    pls[i].forEach((p, pi) => {
      if (canPlaceAll(pls, rest, new Set(p))) live[i].push(pi);
    });
  }

  // Forced / eliminated per target cell.
  const forced = new Set<string>();
  const eliminated = new Set<string>();
  for (const { flat, key } of targets) {
    // Eliminated: no unit has a live placement covering this cell.
    let covered = false;
    for (let i = 0; i < units.length && !covered; i++) {
      for (const p of pls[i]) {
        if (!p.includes(flat)) continue;
        if (canPlaceAll(pls, all.filter((x) => x !== i), new Set(p))) {
          covered = true;
          break;
        }
      }
    }
    if (!covered) {
      eliminated.add(key);
      continue;
    }
    // Forced: removing every placement over this cell makes the items unplaceable
    // (so every arrangement must cover it).
    const blocked = pls.map((list) => list.filter((p) => !p.includes(flat)));
    if (!canPlaceAll(blocked, all, new Set())) forced.add(key);
  }

  // Located items + each located item's region. An item with exactly one live
  // placement is pinned outright. Same-type items that are individually
  // interchangeable are still pinned as a SET: if a type's live placements number
  // exactly its item count, every arrangement must use all of them (they are
  // mutually disjoint), so each item is located — just not labelled, which we
  // resolve canonically (found items take the region holding their record;
  // the rest fill the remaining regions in reading order).
  const located = new Set<number>();
  const regionOf = new Map<number, number[]>(); // item index → placement

  type Group = { unitIdxs: number[] };
  const groups = new Map<string, Group>();
  for (let i = 0; i < units.length; i++) {
    const k = `${units[i].long},${units[i].short}`;
    (groups.get(k) ?? groups.set(k, { unitIdxs: [] }).get(k)!).unitIdxs.push(i);
  }

  for (const { unitIdxs } of groups.values()) {
    // Distinct live placements across the whole type group.
    const distinct = new Map<string, number[]>();
    for (const i of unitIdxs) for (const pi of live[i]) distinct.set(sig(pls[i][pi]), pls[i][pi]);

    if (distinct.size === unitIdxs.length) {
      // Fully pinned set. Assign found units to the region holding their record;
      // remaining regions go to the remaining units in a stable order.
      const regions = [...distinct.values()];
      const taken = new Set<string>();
      const foundUnits = unitIdxs.filter((i) => units[i].found);
      const otherUnits = unitIdxs.filter((i) => !units[i].found);
      for (const i of foundUnits) {
        const region = regions.find(
          (p) => !taken.has(sig(p)) && units[i].recorded.every((f) => p.includes(f)),
        );
        if (!region) continue;
        taken.add(sig(region));
        located.add(units[i].index);
        regionOf.set(units[i].index, region);
      }
      const leftover = regions
        .filter((p) => !taken.has(sig(p)))
        .sort((a, b) => a[0] - b[0]); // reading order by first (top-left) cell
      const remaining = otherUnits.sort((a, b) => units[a].index - units[b].index);
      leftover.forEach((region, j) => {
        const i = remaining[j];
        if (i === undefined) return;
        located.add(units[i].index);
        regionOf.set(units[i].index, region);
      });
    } else {
      // Not pinned as a set, but an individual unit may still be pinned.
      for (const i of unitIdxs) {
        if (live[i].length === 1) {
          located.add(units[i].index);
          regionOf.set(units[i].index, pls[i][live[i][0]]);
        }
      }
    }
  }

  // Attribute each forced cell to its owning located item, when one covers it.
  const forcedItem = new Map<string, number>();
  const flatOf = new Map<string, number>(targets.map((t) => [t.key, t.flat]));
  for (const key of forced) {
    const flat = flatOf.get(key)!;
    for (const [index, region] of regionOf) {
      if (region.includes(flat)) {
        forcedItem.set(key, index);
        break;
      }
    }
  }

  const solvedRegion =
    targets.length > 0 && targets.every((t) => forced.has(t.key) || eliminated.has(t.key));

  return { solvable: true, forced, eliminated, located, forcedItem, solvedRegion };
}
