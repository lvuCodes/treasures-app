// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PICKER_MARGIN,
  PICKER_MAX_HEIGHT,
  PICKER_MAX_WIDTH,
  clampAnchor,
  pickerBounds,
  usePicker,
} from "./usePicker";
import type { MouseEvent } from "react";

const evt = (clientX: number, clientY = 40) => ({ clientX, clientY }) as MouseEvent;

const region = (over: Partial<ReturnType<typeof pickerBounds>> = {}) => ({
  left: 100,
  top: 100,
  right: 700,
  bottom: 600,
  ...over,
});

describe("clampAnchor", () => {
  const bounds = region();

  it("leaves an anchor with room on every side untouched", () => {
    expect(clampAnchor(200, 200, bounds)).toEqual({ x: 200, y: 200 });
  });

  it("pulls the modal back inside the right edge", () => {
    expect(clampAnchor(690, 200, bounds).x).toBe(bounds.right - PICKER_MARGIN - PICKER_MAX_WIDTH);
  });

  it("pulls the modal back inside the bottom edge", () => {
    expect(clampAnchor(200, 590, bounds).y).toBe(bounds.bottom - PICKER_MARGIN - PICKER_MAX_HEIGHT);
  });

  it("keeps the modal below the region's top and right of its left edge", () => {
    expect(clampAnchor(0, 0, bounds)).toEqual({
      x: bounds.left + PICKER_MARGIN,
      y: bounds.top + PICKER_MARGIN,
    });
  });

  it("pins to the leading edge when the region is smaller than the modal", () => {
    const tiny = region({ right: 200, bottom: 200 });
    expect(clampAnchor(180, 180, tiny)).toEqual({
      x: tiny.left + PICKER_MARGIN,
      y: tiny.top + PICKER_MARGIN,
    });
  });
});

describe("pickerBounds", () => {
  it("falls back to the viewport when there is no region", () => {
    window.innerWidth = 1000;
    window.innerHeight = 800;
    expect(pickerBounds(null)).toEqual({ left: 0, top: 0, right: 1000, bottom: 800 });
  });

  it("intersects the region with the viewport", () => {
    window.innerWidth = 500;
    window.innerHeight = 400;
    expect(pickerBounds(region({ left: -50, top: -20 }))).toEqual({
      left: 0,
      top: 0,
      right: 500,
      bottom: 400,
    });
  });
});

describe("usePicker", () => {
  it("starts closed with cleared selection", () => {
    const { result } = renderHook(() => usePicker());
    expect(result.current.anchor).toBeNull();
    expect(result.current.pickerItem).toBeNull();
    expect(result.current.forceMode).toBe(false);
    expect(result.current.overlayTag).toBeUndefined();
  });

  it("opens anchored at the click when the whole modal fits", () => {
    window.innerWidth = 1000;
    window.innerHeight = 800;
    const { result } = renderHook(() => usePicker());
    act(() => result.current.open(evt(100), 2, 3));
    expect(result.current.anchor).toEqual({ r: 2, c: 3, x: 100, y: 40 });
  });

  it("clamps the anchor so the modal stays inside the map region", () => {
    window.innerWidth = 1000;
    window.innerHeight = 800;
    const { result } = renderHook(() => usePicker());
    act(() => result.current.open(evt(690, 590), 0, 0, region()));
    expect(result.current.anchor).toEqual({
      r: 0,
      c: 0,
      x: 700 - PICKER_MARGIN - PICKER_MAX_WIDTH,
      y: 600 - PICKER_MARGIN - PICKER_MAX_HEIGHT,
    });
  });

  it("clamps against the viewport when no region is given", () => {
    window.innerWidth = 400;
    window.innerHeight = 400;
    const { result } = renderHook(() => usePicker());
    act(() => result.current.open(evt(390, 390), 0, 0));
    expect(result.current.anchor?.x).toBe(400 - PICKER_MARGIN - PICKER_MAX_WIDTH);
    expect(result.current.anchor?.y).toBe(400 - PICKER_MARGIN - PICKER_MAX_HEIGHT);
  });

  it("resets everything on close", () => {
    const { result } = renderHook(() => usePicker());
    act(() => {
      result.current.open(evt(10), 0, 0);
      result.current.setPickerItem(3);
      result.current.setForceMode(true);
      result.current.setOverlayTag("initial");
    });
    expect(result.current.pickerItem).toBe(3);

    act(() => result.current.close());
    expect(result.current.anchor).toBeNull();
    expect(result.current.pickerItem).toBeNull();
    expect(result.current.forceMode).toBe(false);
    expect(result.current.overlayTag).toBeUndefined();
  });
});
