// Dev-only tooling — the one release-detachable feature. Every export here is
// referenced from the shell ONLY behind `import.meta.env.DEV`, so Rollup replaces
// that with `false`, drops the dead branches, and tree-shakes this whole folder
// (and its glyphs/CSS) out of the production bundle. Deliberately NO side-effect
// (CSS) imports at this barrel — each leaf component imports its own stylesheet,
// so an unused component takes its CSS with it. See package.json "sideEffects".
export { gopherOverlay } from "./gopher/gopherOverlay";
export { GopherFoot } from "./gopher/GopherFoot";
export { SavedMapsExport, MapStateExport } from "./capture/CaptureButtons";
