// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Picker } from "./Picker";
import { ITEM_TYPES } from "../inventory";
import type { PickerAnchor } from "./usePicker";
import type { DigCode } from "../calculator/session";

afterEach(cleanup);

const soil = (fill = 1): number[][] =>
  Array.from({ length: 10 }, () => new Array<number>(10).fill(fill));

const anchor = (over: Partial<PickerAnchor> = {}): PickerAnchor => ({
  r: 0,
  c: 0,
  x: 10,
  y: 10,
  openLeft: false,
  ...over,
});

function renderPicker(over: Partial<Parameters<typeof Picker>[0]> = {}) {
  const handlers = {
    onApplyPart: vi.fn(),
    onEmpty: vi.fn(),
    onCracked: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    onSelectItem: vi.fn(),
  };
  render(
    <Picker
      anchor={anchor()}
      items={ITEM_TYPES}
      grid={soil()}
      dug={new Map<string, DigCode>()}
      located={new Set<number>()}
      footprints={new Map<number, string[]>()}
      pickerItem={null}
      forceMode={false}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe("Picker — item grid view", () => {
  it("shows the found-item title and the foot actions", () => {
    renderPicker();
    expect(screen.getByText("Record found item here")).toBeTruthy();
    expect(screen.getByText("Empty 0️⃣")).toBeTruthy();
    expect(screen.getByText("⛏️ Hammer")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows the force-mode title instead when forceMode is on", () => {
    renderPicker({ forceMode: true });
    expect(screen.getByText("🟨 Record revealed item")).toBeTruthy();
  });

  it("offers the Rock action only over a rock cell", () => {
    renderPicker(); // all-soil grid
    expect(screen.queryByText("🪨 Rock")).toBeNull();
    cleanup();
    renderPicker({ grid: soil(2) }); // all-rock grid
    expect(screen.getByText("🪨 Rock")).toBeTruthy();
  });

  it("applies immediately for a 1×1 item and drills in for a multi-cell item", () => {
    const h = renderPicker();
    fireEvent.click(screen.getByText(/1×1/));
    expect(h.onApplyPart).toHaveBeenCalledWith(1, undefined);
    fireEvent.click(screen.getByText(/1×2/));
    expect(h.onSelectItem).toHaveBeenCalledWith(2);
  });

  it("wires the foot actions", () => {
    const h = renderPicker({ grid: soil(2) });
    fireEvent.click(screen.getByText("Empty 0️⃣"));
    fireEvent.click(screen.getByText("🪨 Rock"));
    fireEvent.click(screen.getByText("⛏️ Hammer"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(h.onEmpty).toHaveBeenCalledOnce();
    expect(h.onCracked).toHaveBeenCalledOnce();
    expect(h.onClear).toHaveBeenCalledOnce();
    expect(h.onClose).toHaveBeenCalledOnce();
  });

  it("hides a located item that is not already recorded here", () => {
    renderPicker({ located: new Set([1]) });
    // item 1 (1×1) is fully located elsewhere → its button is gone
    expect(screen.queryByText(/1×1/)).toBeNull();
  });

  it("closes on a backdrop click and on a backdrop context-menu", () => {
    const h = renderPicker();
    const backdrop = document.querySelector(".picker-backdrop")!;
    fireEvent.click(backdrop);
    fireEvent.contextMenu(backdrop);
    expect(h.onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Picker — part selection view", () => {
  it("renders the part title and a Back control, wiring both actions", () => {
    const h = renderPicker({ pickerItem: 2 }); // 1×2 → part view
    expect(screen.getByText(/which part\?/)).toBeTruthy();
    // clicking a part glyph applies it
    const parts = document.querySelectorAll("button.part-cell");
    expect(parts.length).toBeGreaterThan(0);
    fireEvent.click(parts[0]);
    expect(h.onApplyPart).toHaveBeenCalledWith(2, expect.any(String));

    fireEvent.click(screen.getByText("← Back"));
    expect(h.onSelectItem).toHaveBeenCalledWith(null);
  });

  it("in force mode renders every part (no feasibility filtering)", () => {
    renderPicker({ pickerItem: 5, forceMode: true }); // 2×2 box
    expect(document.querySelectorAll("button.part-cell").length).toBeGreaterThan(0);
  });
});
