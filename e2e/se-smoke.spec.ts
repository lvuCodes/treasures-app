import { expect, test } from "@playwright/test";
import { defineSeSmoke, SE_VIEWPORT } from "@lvucodes/ui/se-smoke";

// The site builds with base "./" (a relative-path static bundle that also runs
// over file://), so `vite preview` serves it at the server root.
const PATH = "/";

// The shared iPhone SE base suite: no horizontal overflow, back link anchored at
// 20/20, and the primary controls (a.pill, button) unclipped.
defineSeSmoke({ path: PATH, expectBackLink: true });

// Site-specific assertions layered on top of the shared base.
test.describe("Treasures layout", () => {
  test.use({ viewport: SE_VIEWPORT });

  test("the map grid and inventory are visible and within the viewport", async ({ page }) => {
    await page.goto(PATH);

    const grid = page.locator(".grid");
    await expect(grid).toBeVisible();

    const inventory = page.locator(".item-grid");
    await expect(inventory).toBeVisible();

    for (const [name, locator] of [
      ["grid", grid],
      ["item-grid", inventory],
    ] as const) {
      const box = await locator.boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.x, `${name} left edge`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${name} right edge`).toBeLessThanOrEqual(SE_VIEWPORT.width);
    }
  });
});
