# recorder

The right-click recorder modal: choose which item to place under the cursor, then which of its parts sits there. Feasibility is filtered against the solver unless force-mode overrides.

## Files

| File | Role |
|---|---|
| `usePicker.ts` | Modal state: anchor/position (with viewport-edge flip), item/part selection, and the feature-agnostic `forceMode` + `overlayTag`. |
| `Picker.tsx` | Presentational modal (two views: item grid → part grid). Imports the stylesheet. |
| `recorder.css` | Colocated, token-driven, nested styles. |
| `index.ts` | Barrel. |

## Feature-agnostic hooks

- **`forceMode`** — "trust the user over the solver": skips feasibility filtering and changes the title. The recorder owns it; a feature turns it on (a reveal is ground truth).
- **`overlayTag`** — the opaque tag stamped on the next recorded item.
- **`footerSlot`** — extra controls under the item grid; `undefined` in production. The dev gopher tooling fills it and drives `forceMode`/`overlayTag`.

The shell binds the picker's callbacks (`onApplyPart`, `onEmpty`, …) to the anchor cell and the session's record actions.
