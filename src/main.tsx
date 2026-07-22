/*
 * Treasures Dig Optimizer — a helper for the Monopoly GO treasure-map minigames.
 * Copyright (C) 2026 lvuCodes
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later
 * version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// The package.json `sideEffects` allowlist marks first-party modules pure so the
// dev-only folder tree-shakes out of production. Rollup does not honour those
// globs for app source, so a barrel's own `import "…theme.css"` gets dropped
// from the bundle — the palette must be pulled in from the entry, which is never
// shaken, or the built app ships with no colour tokens at all.
import "@lvucodes/ui/theme.css";
import App from "./App.tsx";
// Site CSS after the App import so its rules win the equal-specificity cascade
// on source order over the shared @lvucodes/ui primitives App.tsx pulls in.
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
