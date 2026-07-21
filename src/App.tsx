import { useState } from "react";
import "./App.css";
import { ThemeSwitcher, useTheme } from "./theme";
import { centerGrid, emptyGrid } from "./grid";
import { SavedMaps, useSavedMaps } from "./saved-maps";
import { InputGrid, useMapPaint } from "./map-input";
import {
  FoundKeptTable,
  ITEM_TYPES,
  ItemStatusTable,
  ItemSteppers,
} from "./inventory";
import { useDigSession } from "./session";
import { Picker, usePicker } from "./recorder";
import { ResultGrid } from "./map-display";
import { GopherFoot, MapStateExport, SavedMapsExport, gopherOverlay } from "./dev";
import { About } from "./about";
import {
  cellKey,
  nextDigCode,
  partGlyphForFootprint,
  type DigCode,
} from "./calculator/session";

function App() {
  const [grid, setGrid] = useState<number[][]>(emptyGrid);
  // Saved-map retention: persisted terrain, the carousel, and the save/load
  // status line. Also provides the session's auto-save-on-Calculate seam.
  const saved = useSavedMaps();
  // The coupled session state machine: item counts, per-cell recording maps, the
  // opaque overlay channel, undo history, and the latest evaluation.
  const session = useDigSession({
    grid,
    itemTypes: ITEM_TYPES,
    onCalculate: (g) => saved.save(g, true),
  });
  const {
    counts, dug, parts, overlay, result, error, history, total,
    locked, repick, inputMode, expandedItems, foundSet, repickFound, footprints,
  } = session;

  // Recorder modal (position, item/part selection, generic force-mode + tag).
  const picker = usePicker();
  const [theme, setTheme] = useTheme();

  // Terrain drawing for the input map (click-cycle + drag-paint).
  const paint = useMapPaint({ grid, setGrid, locked });

  // Shell wrappers around the session's picker-agnostic actions: they also close
  // the recorder modal (shell-owned).
  function recordCell(r: number, c: number, dugVal: DigCode, glyph?: string, overlayTag?: string) {
    session.recordCell(r, c, dugVal, glyph, overlayTag);
    picker.close();
  }

  function clearCell(r: number, c: number) {
    session.clearCell(r, c);
    picker.close();
  }

  // Clear all recorded digs and recompute from the bare map + items (Reset).
  function startSession() {
    session.startSession();
    picker.close();
  }

  // Return to the input phase (un-lock), clearing the session.
  function resetToInput() {
    session.resetToInput();
    picker.close();
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
      session.commit(key, "cracked", undefined, undefined);
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
    session.commit(key, nextDigCode(code, terrain), undefined, undefined);
  }

  // Recorder actions: each sets one cell, clearing any prior part. `applyPart`
  // stamps the recorder's current overlay tag (set by a feature via the footer
  // slot; undefined in the normal flow).
  const setEmpty = (r: number, c: number) => recordCell(r, c, 0);
  const setCracked = (r: number, c: number) => recordCell(r, c, "cracked");
  const applyPart = (r: number, c: number, itemIndex: number, glyph: string | undefined) =>
    recordCell(r, c, itemIndex, glyph, picker.overlayTag);

  // Open the recorder over a cell — guarded to solve mode on a diggable cell.
  function openPicker(e: React.MouseEvent, r: number, c: number) {
    e.preventDefault();
    if (!locked || repick || grid[r][c] === 0) return;
    picker.open(e, r, c);
  }

  // Clear the input map back to all walls and reset item counts to zero.
  function clearMap() {
    setGrid(emptyGrid());
    session.clearCounts();
  }

  function newSession() {
    setGrid(emptyGrid());
    session.newSession();
    picker.close();
  }

  // Recovery from an unsolvable state: keep the map AND every recorded dig, zero
  // the item counts, and swap the item panel to the count steppers so the player
  // can re-pick the inventory and recalculate from the same board. The map stays
  // locked/frozen throughout. (Clearing the map too is "New Map".)
  function resetItems() {
    session.resetItems();
    picker.close();
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

  // Payload for the dev map-state capture: the full board + recorded state as
  // [key, value] pairs (rebuildable with new Map(...)). Built lazily at export.
  const mapStatePayload = () => ({
    grid,
    counts,
    dug: [...dug],
    parts: [...parts],
    overlay: [...overlay],
  });

  return (
    <main className="app">
      <div className="header-bar">
        <h1>Treasures Dig Optimizer</h1>
      </div>

      <About />

      <div className="layout">
        <section>
          <h2>{locked ? "Map" : "Input Map"}</h2>

          {!locked ? (
            <InputGrid
              grid={grid}
              paintDown={paint.paintDown}
              paintEnter={paint.paintEnter}
              cellClick={paint.cellClick}
              dragSize={paint.dragSize}
            />
          ) : (
            result && (
              <ResultGrid
                grid={grid}
                result={result}
                dug={dug}
                overlay={overlay}
                onCellClick={cycleDig}
                onCellContextMenu={openPicker}
                overlaySlot={import.meta.env.DEV ? gopherOverlay : undefined}
              />
            )
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
                // Dev-only saved-maps export — dropped from prod via the DEV guard.
                import.meta.env.DEV ? <SavedMapsExport maps={saved.maps} /> : undefined
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
              <FoundKeptTable rows={repickFound} />
              <p className="hint">Declare hidden pieces to add:</p>
            </>
          )}
          {!locked && (
            <p className="hint">Set item counts.</p>
          )}
          {inputMode && (
            <>
              <ItemSteppers
                counts={counts}
                onChange={session.changeCount}
                atCap={(repick ? repickFound.length : 0) + total >= 10}
              />

              {(repick ? repickFound.length : 0) + total >= 10 && (
                <p className="hint">Maximum of 10 items reached.</p>
              )}
              <button className="primary" onClick={session.submit}>
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

              <ItemStatusTable
                items={expandedItems}
                foundSet={foundSet}
                located={result?.located ?? new Set()}
              />

              <div className="actions">
                <button
                  className="primary"
                  onClick={session.undo}
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

              {/* Dev-only map-state capture — tree-shaken from prod via the guard. */}
              {import.meta.env.DEV && <MapStateExport getPayload={mapStatePayload} />}
            </>
          )}
        </section>
      </div>

      {picker.anchor && (
        <Picker
          anchor={picker.anchor}
          items={expandedItems}
          grid={grid}
          dug={dug}
          located={result?.located ?? new Set()}
          footprints={footprints}
          pickerItem={picker.pickerItem}
          forceMode={picker.forceMode}
          onApplyPart={(itemIndex, glyph) =>
            applyPart(picker.anchor!.r, picker.anchor!.c, itemIndex, glyph)
          }
          onEmpty={() => setEmpty(picker.anchor!.r, picker.anchor!.c)}
          onCracked={() => setCracked(picker.anchor!.r, picker.anchor!.c)}
          onClear={() => clearCell(picker.anchor!.r, picker.anchor!.c)}
          onClose={picker.close}
          onSelectItem={picker.setPickerItem}
          footerSlot={
            // Dev-only gopher tooling — dropped from prod via the DEV guard.
            import.meta.env.DEV ? (
              <GopherFoot
                r={picker.anchor.r}
                c={picker.anchor.c}
                terrain={grid[picker.anchor.r][picker.anchor.c]}
                forceMode={picker.forceMode}
                setForceMode={picker.setForceMode}
                setOverlayTag={picker.setOverlayTag}
                recordCell={recordCell}
              />
            ) : undefined
          }
        />
      )}

      <footer className="credits">

        <ThemeSwitcher theme={theme} onChange={setTheme} />

        <p className="credits-copyright">
          © 2026{" "}
          <a href="https://github.com/lvuCodes" target="_blank" rel="noreferrer noopener">
            lvuCodes
          </a>
          . Free software under the{" "}
          <a
            href="https://github.com/lvuCodes/treasures-app/blob/main/LICENSE"
            target="_blank"
            rel="noreferrer noopener"
          >
            GNU GPL v3
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

export default App;
