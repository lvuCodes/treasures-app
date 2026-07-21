// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BackLink } from "./BackLink";

afterEach(cleanup);

describe("BackLink", () => {
  it("points at the author's home page by default", () => {
    render(<BackLink />);
    const link = screen.getByRole("link", { name: "← Home" });
    expect(link.getAttribute("href")).toBe("https://lvucodes.github.io");
  });

  it("wears the shared pill skin rather than its own", () => {
    render(<BackLink />);
    expect(screen.getByRole("link", { name: "← Home" }).className).toBe("pill");
  });

  it("honours a custom target and label", () => {
    render(<BackLink href="/elsewhere" label="← Back" />);
    expect(screen.getByRole("link", { name: "← Back" }).getAttribute("href")).toBe("/elsewhere");
  });
});
