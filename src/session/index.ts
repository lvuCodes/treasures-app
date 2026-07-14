// The session state machine: the coupled recording cluster (dug / parts / overlay
// / history / result) as a pure reducer plus its thin React binding. Feature-
// agnostic — the overlay channel is opaque, so the core never names a feature.
export { useDigSession } from "./useDigSession";
export { sessionReducer, initSession } from "./reducer";
export type { SessionState, SessionAction, HistoryEntry } from "./types";
