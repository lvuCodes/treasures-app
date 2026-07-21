// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SavedMaps } from "./SavedMaps";

afterEach(cleanup);

// A distinct full-size terrain grid per index so MiniMap has something to crop.
const map = (i: number): number[][] => {
  const g = Array.from({ length: 10 }, () => new Array<number>(10).fill(0));
  g[0][0] = 1;
  g[0][i] = 1;
  return g;
};

const defaults = {
  cardsRef: createRef<HTMLDivElement>(),
  cardEnds: { atStart: true, atEnd: false },
  onScroll: () => {},
  onScrollBy: () => {},
  onDelete: () => {},
  onLoad: () => {},
};

describe("SavedMaps", () => {
  it("renders nothing when there are no maps", () => {
    const { container } = render(<SavedMaps {...defaults} maps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows one card per map without arrows for three or fewer", () => {
    render(<SavedMaps {...defaults} maps={[map(1), map(2)]} />);
    expect(screen.getAllByLabelText(/load saved map/)).toHaveLength(2);
    expect(screen.queryByLabelText("previous saved maps")).toBeNull();
  });

  it("shows carousel arrows once there are more than three maps", () => {
    render(<SavedMaps {...defaults} maps={[1, 2, 3, 4].map(map)} />);
    expect(screen.getByLabelText("previous saved maps")).toBeTruthy();
    expect(screen.getByLabelText("next saved maps")).toBeTruthy();
  });

  it("disables the previous arrow at the start and enables next", () => {
    render(<SavedMaps {...defaults} maps={[1, 2, 3, 4].map(map)} />);
    expect((screen.getByLabelText("previous saved maps") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("next saved maps") as HTMLButtonElement).disabled).toBe(false);
  });

  it("fires load and delete callbacks with the right index", () => {
    const onLoad = vi.fn();
    const onDelete = vi.fn();
    const maps = [map(1), map(2)];
    render(<SavedMaps {...defaults} maps={maps} onLoad={onLoad} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText("load saved map 2"));
    expect(onLoad).toHaveBeenCalledWith(maps[1]);

    fireEvent.click(screen.getByLabelText("delete saved map 1"));
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it("fires scroll-by when an arrow is pressed", () => {
    const onScrollBy = vi.fn();
    render(
      <SavedMaps
        {...defaults}
        maps={[1, 2, 3, 4].map(map)}
        onScrollBy={onScrollBy}
        cardEnds={{ atStart: false, atEnd: false }}
      />,
    );
    fireEvent.click(screen.getByLabelText("next saved maps"));
    expect(onScrollBy).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("previous saved maps"));
    expect(onScrollBy).toHaveBeenCalledWith(-1);
  });

  it("renders a footer slot when provided", () => {
    render(<SavedMaps {...defaults} maps={[map(1)]} footerSlot={<div>export here</div>} />);
    expect(screen.getByText("export here")).toBeTruthy();
  });
});
