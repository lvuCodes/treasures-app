// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { About } from "./About";

afterEach(() => {
  cleanup();
  document.body.classList.remove("about-open");
});

describe("About", () => {
  it("renders only the toggle until it is opened", () => {
    render(<About />);
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("opens the sidebar and scoots the page", async () => {
    const user = userEvent.setup();
    render(<About />);

    await user.click(screen.getByRole("button", { name: "About" }));

    expect(
      screen.getByRole("complementary", { name: "About Treasures Dig Optimizer" }),
    ).toBeTruthy();
    expect(document.body.classList.contains("about-open")).toBe(true);
    expect(screen.queryByRole("button", { name: "About" })).toBeNull();
  });

  it("closes again and releases the scoot", async () => {
    const user = userEvent.setup();
    render(<About />);

    await user.click(screen.getByRole("button", { name: "About" }));
    await user.click(screen.getByRole("button", { name: "Close about" }));

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.body.classList.contains("about-open")).toBe(false);
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
  });
});
