import { test, expect } from "@playwright/test";

/**
 * PR23.7 Browser E2E for persisted startup scheduling and console VTE.
 * Uses versioned, immutable schema metadata only; never edits real files.
 */
test("PR23.7 version change schedules exactly one VTE check",
	async ({ page }) => {
		await page.goto("/");
		await page.evaluate(async () => {
			const { UIProtocolPolicy } = await import(
				"/Implementation/property/UIProtocolPolicy.js");
			const { UICOActionContractDescriptors } = await import(
				"/Implementation/property/UICOActionContractDescriptors.js");
			const { UISP } = await import(
				"/Implementation/property/UISP.js");
			const baseline = {
				version: "old-release",
				actions: UICOActionContractDescriptors.build(
					UIProtocolPolicy.capabilities, UISP.version)
			};
			localStorage.setItem("cluster.uico.vte.v1", JSON.stringify({
				openedVersion: "old-release",
				currentSnapshot: baseline,
				status: "pass"
			}));
		});
		await page.reload();
		await expect.poll(() => page.evaluate(() => {
			const raw = localStorage.getItem("cluster.uico.vte.v1");
			return raw ? JSON.parse(raw).status : null;
		})).toBe("pass");
		const audit = await page.evaluate(() => window.Cluster.log()
			.filter(entry => entry.action === "UICO_TEST"));
		expect(audit).toHaveLength(1);
		expect(audit[0].kind).toBe("Log");
		const consoleResult = await page.evaluate(() => window.VTE.UICO_TEST());
		expect(consoleResult.status).toBe("PASS");
		expect(consoleResult.reasons).toContain("manual");
	}
);

test("PR23.7 same-version startup skips duplicate background check",
	async ({ page }) => {
		await page.goto("/");
		await page.evaluate(() => {
			localStorage.setItem("cluster.uico.vte.v1", JSON.stringify({
				openedVersion: window.Cluster.version(), status: "pass"
			}));
		});
		await page.reload();
		const info = await page.evaluate(() => ({
			audit: window.Cluster.log().filter(
				entry => entry.action === "UICO_TEST"),
			status: JSON.parse(localStorage.getItem("cluster.uico.vte.v1")).status
		}));
		expect(info.audit).toEqual([]);
		expect(info.status).toBe("pass");
	}
);
