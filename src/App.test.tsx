// @vitest-environment jsdom
//
// Integration tests for the App shell. These drive the real component through
// its accessible surface (roles / labels / text), never its internals, so they
// double as the regression net for the ongoing modularization: the session hook,
// recorder, and map-display extractions must all keep these green.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

// A map cell button is labelled by its "r,c" key.
const cell = (r: number, c: number) => screen.getByRole("button", { name: `${r},${c}` });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement).disabled;

// Draw a 2×2 soil block at the top-left (each click cycles wall → dig).
function drawSquare() {
  for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
    fireEvent.click(cell(r, c));
  }
}

// Draw the square, declare one 1×1 item, and Calculate — lands in locked/solve mode.
function calculateSquare() {
  drawSquare();
  fireEvent.click(button("increase 1×1"));
  fireEvent.click(button("Calculate!"));
}

describe("map input", () => {
  it("cycles a cell wall → dig → rock → wall on successive clicks", () => {
    render(<App />);
    expect(cell(2, 2).className).toContain("terrain-0");
    fireEvent.click(cell(2, 2));
    expect(cell(2, 2).className).toContain("terrain-1");
    fireEvent.click(cell(2, 2));
    expect(cell(2, 2).className).toContain("terrain-2");
    fireEvent.click(cell(2, 2));
    expect(cell(2, 2).className).toContain("terrain-0");
  });
});

describe("calculate", () => {
  it("rejects an empty inventory then locks the map once an item is declared", () => {
    render(<App />);
    drawSquare();
    fireEvent.click(button("Calculate!"));
    expect(screen.getByText(/Add at least one item/i)).toBeTruthy();
    // Still in input mode.
    expect(screen.getByRole("heading", { name: "Input Map" })).toBeTruthy();

    fireEvent.click(button("increase 1×1"));
    fireEvent.click(button("Calculate!"));
    // Locked: heading flips and the solve-mode controls appear.
    expect(screen.getByRole("heading", { name: "Map" })).toBeTruthy();
    expect(button("New Map")).toBeTruthy();
  });
});

describe("record + undo", () => {
  it("enables Undo after a recorded dig and reverts on Undo", () => {
    render(<App />);
    calculateSquare();
    expect(isDisabled(button(/Undo/))).toBe(true);

    fireEvent.click(cell(0, 0)); // record a hit on a solve-mode cell
    expect(isDisabled(button(/Undo/))).toBe(false);

    fireEvent.click(button(/Undo/));
    expect(isDisabled(button(/Undo/))).toBe(true);
  });
});

describe("recorder", () => {
  it("records a found item via the right-click picker", () => {
    render(<App />);
    calculateSquare();
    // A fresh 1×1 starts unfound.
    expect(screen.getByText("❌ not found")).toBeTruthy();
    // Right-click opens the recorder; the 1×1 button places the find.
    fireEvent.contextMenu(cell(0, 0));
    fireEvent.click(button(/1×1/));
    // The item is now located, so no row reads "not found".
    expect(screen.queryByText("❌ not found")).toBeNull();
  });
});

describe("new map", () => {
  it("returns to input mode from solve mode", () => {
    render(<App />);
    calculateSquare();
    expect(screen.getByRole("heading", { name: "Map" })).toBeTruthy();
    fireEvent.click(button("New Map"));
    expect(screen.getByRole("heading", { name: "Input Map" })).toBeTruthy();
  });
});

describe("saved maps", () => {
  it("saves a drawn map into the carousel and persists it", () => {
    render(<App />);
    drawSquare();
    fireEvent.click(button("Save map"));
    expect(button("load saved map 1")).toBeTruthy();
    expect(localStorage.getItem("mogo-saved-maps")).toBeTruthy();
  });

  it("declines to save an empty map", () => {
    render(<App />);
    fireEvent.click(button("Save map"));
    expect(screen.getByText(/Draw a map first/i)).toBeTruthy();
    expect(localStorage.getItem("mogo-saved-maps")).toBeNull();
  });
});

describe("theme", () => {
  it("persists the selected theme and reflects it on the document", () => {
    render(<App />);
    fireEvent.click(button("Homebrew"));
    expect(localStorage.getItem("mogo-theme")).toBe("homebrew");
    expect(document.documentElement.dataset.theme).toBe("homebrew");
  });
});

describe("footer copyright", () => {
  it("carries the GPL notice and links the license", () => {
    render(<App />);

    const notice = screen.getByText(/© 2026/);
    expect(notice.textContent).toContain("Free software under the");

    const license = screen.getByRole("link", { name: "GNU GPL v3" });
    expect(license.getAttribute("href")).toBe(
      "https://github.com/lvuCodes/treasures-app/blob/main/LICENSE",
    );
    expect(screen.getByRole("link", { name: "lvuCodes" }).getAttribute("href")).toBe(
      "https://github.com/lvuCodes",
    );
  });
});
