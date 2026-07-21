# dev

Dev-only tooling — **the one release-detachable feature**. Everything here is referenced from the shell *only* behind `import.meta.env.DEV`, so `vite build` replaces that with `false`, drops the dead branches, and tree-shakes this whole folder (its glyphs, components, and CSS) out of the production bundle.

## Structure

| Path | Role |
|---|---|
| `gopher/gopherOverlay.ts` | The map-display `OverlaySlot` that paints gopher glyphs + a gold background for a tagged cell. |
| `gopher/GopherFoot.tsx` | The recorder footer buttons (log gopher, arm force-mode + the `"hit"` overlay tag). |
| `gopher/gopher.css` | `.cell.gopher` + `.gopher-foot`. |
| `capture/capture.ts` | POST an export payload to the dev server's `/__capture` endpoint (see `vite.config.ts`). |
| `capture/CaptureButtons.tsx` | `SavedMapsExport` + `MapStateExport` — write state to `captures/` on disk. |
| `capture/capture.css` | The export button containers. |
| `index.ts` | Barrel — **no side-effect (CSS) imports** here, so an unused leaf takes its CSS with it. |

## Subset-release contract

- Reference every export ONLY behind `import.meta.env.DEV`. No unguarded reference may reach the prod graph.
- Import each stylesheet inside its leaf component, never at the barrel (Rollup keeps side-effectful CSS imports even when the JS is unused). `package.json` sets `"sideEffects": ["**/*.css"]`.
- `scripts/build-singlefile.mjs` greps the final HTML for dev sentinels and fails the build if any survive — the invariant is enforced, not assumed.

To drop dev tooling from a build entirely, remove this folder + its `import.meta.env.DEV` reference lines in `App.tsx`; no core edits are needed.
