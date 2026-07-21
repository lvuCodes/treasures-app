// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FoundKeptTable, ItemStatusTable } from "./ItemTable";

afterEach(cleanup);

const items = [{ label: "coin" }, { label: "bar" }, { label: "chest" }];

describe("ItemStatusTable", () => {
  it("renders each status: not found, found, located", () => {
    render(<ItemStatusTable items={items} foundSet={new Set([2])} located={new Set([3])} />);
    expect(screen.getByText("❌ not found")).toBeTruthy();
    expect(screen.getByText("✅ found")).toBeTruthy();
    expect(screen.getByText("located")).toBeTruthy();
  });

  it("gives found and located rows the colour class, leaves not-found plain", () => {
    const { container } = render(
      <ItemStatusTable items={items} foundSet={new Set([1])} located={new Set([2])} />,
    );
    expect(container.querySelectorAll("tr.is-found")).toHaveLength(2);
  });
});

describe("FoundKeptTable", () => {
  it("renders nothing when there are no kept rows", () => {
    const { container } = render(<FoundKeptTable rows={[]} />);
    expect(container.querySelector("table")).toBeNull();
  });

  it("renders known dims, a fallback for unknown dims, and both statuses", () => {
    render(
      <FoundKeptTable
        rows={[
          { code: 1, dims: { long: 2, short: 1 }, located: true },
          { code: 2, dims: undefined, located: false },
        ]}
      />,
    );
    expect(screen.getByText(/2×1/)).toBeTruthy();
    expect(screen.getByText(/\?/)).toBeTruthy();
    expect(screen.getByText("located")).toBeTruthy();
    expect(screen.getByText("✅ found")).toBeTruthy();
  });
});
