import type { ReactNode, RefObject } from "react";
import { MiniMap } from "./MiniMap";
import "./saved-maps.css";

interface SavedMapsProps {
  maps: number[][][];
  cardsRef: RefObject<HTMLDivElement | null>;
  cardEnds: { atStart: boolean; atEnd: boolean };
  onScroll: () => void; // carousel scrolled — recompute end state
  onScrollBy: (dir: number) => void; // arrow pressed
  onDelete: (i: number) => void;
  onLoad: (m: number[][]) => void;
  // Extra controls rendered under the carousel (e.g. the dev export block);
  // undefined in production, so nothing dev ships here.
  footerSlot?: ReactNode;
}

// Presentational saved-maps carousel: click a card to load its terrain, ✕ to
// delete. Shows three mini-map cards at a time with arrows once there are more.
// Renders nothing when there are no saved maps.
export function SavedMaps({
  maps,
  cardsRef,
  cardEnds,
  onScroll,
  onScrollBy,
  onDelete,
  onLoad,
  footerSlot,
}: SavedMapsProps) {
  if (maps.length === 0) return null;
  return (
    <div className="saved-maps">
      <span>Saved maps:</span>
      <div className="map-carousel">
        {maps.length > 3 && (
          <button
            className="carousel-btn"
            onClick={() => onScrollBy(-1)}
            disabled={cardEnds.atStart}
            aria-label="previous saved maps"
          >
            ‹
          </button>
        )}
        <div className="map-cards" ref={cardsRef} onScroll={onScroll}>
          {maps.map((m, i) => (
            <div className="map-card" key={i}>
              <button
                className="card-remove"
                onClick={() => onDelete(i)}
                aria-label={`delete saved map ${i + 1}`}
              >
                ✕
              </button>
              <button
                className="card-load"
                onClick={() => onLoad(m)}
                aria-label={`load saved map ${i + 1}`}
              >
                <MiniMap grid={m} />
              </button>
            </div>
          ))}
        </div>
        {maps.length > 3 && (
          <button
            className="carousel-btn"
            onClick={() => onScrollBy(1)}
            disabled={cardEnds.atEnd}
            aria-label="next saved maps"
          >
            ›
          </button>
        )}
      </div>
      {footerSlot}
    </div>
  );
}
