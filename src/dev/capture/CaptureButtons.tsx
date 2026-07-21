import { useState } from "react";
import { saveCapture } from "./capture";
import "./capture.css";

// Dev-only: write all saved maps (terrain grids) to captures/ on disk, as a
// portable backup of the saved-maps localStorage entry. Rendered in the saved-
// maps carousel footer slot.
export function SavedMapsExport({ maps }: { maps: number[][][] }) {
  const [status, setStatus] = useState("");
  return (
    <div className="saved-maps-actions">
      <button onClick={async () => setStatus(await saveCapture("saved-maps", maps))}>
        💾 Export saved maps
      </button>
      {status && <span className="hint">{status}</span>}
    </div>
  );
}

// Dev-only: serialize the current map + full recorded state (incl. the overlay)
// and write it to captures/ on disk for integration back into the app. The
// payload is built lazily at click time from the live session. Maps go out as
// [key, value] pairs (rebuildable with new Map(...)).
export function MapStateExport({ getPayload }: { getPayload: () => unknown }) {
  const [status, setStatus] = useState("");
  return (
    <div className="actions gopher-actions">
      <button
        className="primary"
        onClick={async () => setStatus(await saveCapture("map-state", getPayload()))}
      >
        💾 Save map state
      </button>
      {status && <span className="hint">{status}</span>}
    </div>
  );
}
