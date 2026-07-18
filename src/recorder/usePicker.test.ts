// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PICKER_MAX_WIDTH, usePicker } from "./usePicker";
import type { MouseEvent } from "react";

const evt = (clientX: number, clientY = 40) => ({ clientX, clientY }) as MouseEvent;

describe("usePicker", () => {
  it("starts closed with cleared selection", () => {
    const { result } = renderHook(() => usePicker());
    expect(result.current.anchor).toBeNull();
    expect(result.current.pickerItem).toBeNull();
    expect(result.current.forceMode).toBe(false);
    expect(result.current.overlayTag).toBeUndefined();
  });

  it("opens anchored at the click, growing right when there is room", () => {
    window.innerWidth = 1000;
    const { result } = renderHook(() => usePicker());
    act(() => result.current.open(evt(100), 2, 3));
    expect(result.current.anchor).toEqual({ r: 2, c: 3, x: 100, y: 40, openLeft: false });
  });

  it("flips left when the modal would overflow the right edge", () => {
    window.innerWidth = 1000;
    const { result } = renderHook(() => usePicker());
    act(() => result.current.open(evt(1000 - PICKER_MAX_WIDTH + 1), 0, 0));
    expect(result.current.anchor?.openLeft).toBe(true);
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
