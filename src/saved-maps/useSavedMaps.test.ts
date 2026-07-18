// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSavedMaps } from "./useSavedMaps";

// Storage keys maps by their 10×10 bounding-box signature, so fixtures must be
// full SIZE×SIZE grids.
const blank = (): number[][] => Array.from({ length: 10 }, () => new Array<number>(10).fill(0));
const drawn = (r = 0, c = 0): number[][] => {
  const g = blank();
  g[r][c] = 1;
  return g;
};
const empty = blank;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSavedMaps", () => {
  it("saves a drawn map and sets the status line", () => {
    const { result } = renderHook(() => useSavedMaps());
    act(() => result.current.save(drawn()));
    expect(result.current.maps).toHaveLength(1);
    expect(result.current.status).toBe("Map saved.");
  });

  it("rejects an empty map with a prompt", () => {
    const { result } = renderHook(() => useSavedMaps());
    act(() => result.current.save(empty()));
    expect(result.current.maps).toHaveLength(0);
    expect(result.current.status).toBe("Draw a map first.");
  });

  it("rejects a duplicate map", () => {
    const { result } = renderHook(() => useSavedMaps());
    act(() => result.current.save(drawn()));
    act(() => result.current.save(drawn()));
    expect(result.current.maps).toHaveLength(1);
    expect(result.current.status).toBe("Map already saved.");
  });

  it("stays silent when saved with silent=true", () => {
    const { result } = renderHook(() => useSavedMaps());
    act(() => result.current.save(empty(), true));
    expect(result.current.status).toBe("");
  });

  it("auto-dismisses the status line after 5s", () => {
    const { result } = renderHook(() => useSavedMaps());
    act(() => result.current.save(drawn()));
    expect(result.current.status).toBe("Map saved.");
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.status).toBe("");
  });

  it("removes a saved map by index and clears the status", () => {
    const { result } = renderHook(() => useSavedMaps());
    const two = blank();
    two[0][0] = 1;
    two[0][1] = 1; // a 1×2 shape — a distinct signature from the single cell
    act(() => result.current.save(drawn(0, 0)));
    act(() => result.current.save(two));
    expect(result.current.maps).toHaveLength(2);
    act(() => result.current.remove(0));
    expect(result.current.maps).toHaveLength(1);
    expect(result.current.status).toBe("");
  });

  it("persists across a fresh hook via storage", () => {
    const first = renderHook(() => useSavedMaps());
    act(() => first.result.current.save(drawn()));
    const second = renderHook(() => useSavedMaps());
    expect(second.result.current.maps).toHaveLength(1);
  });
});
