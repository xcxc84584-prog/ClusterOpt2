import { test, expect } from "@playwright/test";

/**
 * PR23.1 runtime smoke audit; no plugin install, mutation, or file write.
 * The static list is a source inventory, not a runtime completeness claim.
 */
test("PR23.1 native UI inventory: shell and plugin UI states",
	async ({ page }) => {
		await page.goto("/");

		const snapshot = async () => page.evaluate(() => {
			const elements = [...document.querySelectorAll("[id]")];
			const ids = elements.map(element => element.id);
			const duplicates = ids.filter((id, index) =>
				ids.indexOf(id) !== index);
			return {
				count: elements.length,
				duplicates,
				pluginWindow: Boolean(
					document.getElementById("pluginWindow")),
				editor: Boolean(document.getElementById("editor")),
				explorer: Boolean(
					document.getElementById("explorerPanel"))
			};
		});

		const initial = await snapshot();
		expect(initial.duplicates).toEqual([]);
		expect(initial.editor).toBe(true);
		expect(initial.explorer).toBe(true);

		await page.locator("#menuBtn").click();
		await page.locator("#toolBtn").click();
		await page.locator("#pluginBtn").click();
		await expect(page.locator("#pluginWindow")).toBeVisible();
		await expect(page.locator(".pm-tabs [role=tab]").first())
			.toBeVisible();
		const expanded = await snapshot();
		expect(expanded.duplicates).toEqual([]);
		expect(expanded.pluginWindow).toBe(true);
		expect(expanded.count).toBeGreaterThanOrEqual(initial.count);
	}
);
