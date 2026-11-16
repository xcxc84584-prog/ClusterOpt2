import { test, expect } from "@playwright/test";

test("PR6 reload recovers editor text, tabs and viewport scroll", async ({ page }) => {
  page.on("dialog", dialog => { void dialog.accept(); });
  await page.goto("/");
  await page.locator("#explorerToggle").click();
  await page.locator("#menuBtn").click();
  await page.locator("#newFile").click();
  const lines = Array.from({ length: 200 }, (_, i) =>
    "Line " + String(i).padStart(3, "0")).join("\n");
  await page.locator("#editor").fill(lines);
  await page.locator("#editor").evaluate(node => {
    node.scrollTop = 900;
    node.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator("#tabs .tab")).toHaveCount(1);
  // Wait for the actual IndexedDB transaction instead of a fixed delay.
  await page.waitForFunction(async () => {
    return new Promise(resolve => {
      const request = indexedDB.open("clusteropt2-session", 1);
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("snapshots", "readonly");
        const get = tx.objectStore("snapshots").get("current");
        get.onsuccess = () => {
          const snapshot = get.result;
          resolve(snapshot?.documents?.[0]?.text?.includes("Line 199"));
        };
        get.onerror = () => resolve(false);
        tx.oncomplete = () => db.close();
      };
    });
  });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(500);
  const diagnostic = await page.evaluate(() => ({
    logs: window.Cluster?.log().slice(0,25),
    version: window.Cluster?.version(),
    tabCount: document.querySelectorAll("#tabs .tab").length,
    status: document.querySelector("#status")?.textContent
  }));
  console.log("RECOVERY-DIAGNOSTIC", JSON.stringify(diagnostic));
  await expect(page.locator("#tabs .tab")).toHaveCount(1);
  await expect(page.locator("#editor")).toHaveValue(lines);
  await expect(page.locator("#explorerPanel")).toBeVisible();
  await expect.poll(() => page.locator("#editor").evaluate(
    element => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator("#explorerTree .explorer-entry")).toHaveCount(1);
});
