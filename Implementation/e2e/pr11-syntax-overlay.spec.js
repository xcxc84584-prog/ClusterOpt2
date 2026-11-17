import {test, expect} from "@playwright/test";

test("PR11 mounted provider renders safe native-editor overlay", async ({page}) => {
	await page.goto("/");
	const result = await page.evaluate(async () => {
		const {linkCore} = await import(
			"/Implementation/LinkCore/LinkCore.js");
		const {install} = await import(
			"/Implementation/plugins/multilang-highlighter.js");
		const {SyntaxOverlayController} = await import(
			"/Implementation/main/syntax-overlay-controller.js");
		const mounted = install(linkCore);
		const surface = document.createElement("div");
		surface.style.cssText = [
			"position:relative", "display:flex", "width:600px",
			"height:250px"
		].join(";");
		const textarea = document.createElement("textarea");
		textarea.value = "const answer = 42; // note";
		textarea.style.cssText = [
			"width:100%", "height:100%", "font:14px/22px monospace",
			"padding:16px"
		].join(";");
		surface.append(textarea);
		document.body.append(surface);
		const overlay = new SyntaxOverlayController(
			linkCore, textarea, surface);
		overlay.setDocument("test-1", "sample.js");
		overlay.enable();
		return {mounted, elementId: overlay.container.id};
	});
	expect(result.mounted.ok).toBeTruthy();
	expect(result.elementId).toBe("pr11SyntaxOverlay");
	await expect(page.locator("#pr11SyntaxOverlay:not([hidden])"))
		.toBeVisible();
	await expect(page.locator(
		"#pr11SyntaxOverlay .pm-token-keyword")).toContainText("const");
	await expect(page.locator("#editor.syntax-overlay-active"))
		.toHaveCount(0);
	const unchanged = await page.locator(
		"#pr11SyntaxOverlay").evaluate(el =>
		el.parentElement.querySelector("textarea").value);
	expect(unchanged).toBe("const answer = 42; // note");
});

test("PR11 input changes invalidate an old syntax response", async ({page}) => {
	await page.goto("/");
	await page.evaluate(async () => {
		const {linkCore} = await import(
			"/Implementation/LinkCore/LinkCore.js");
		const {install} = await import(
			"/Implementation/plugins/multilang-highlighter.js");
		const {SyntaxOverlayController} = await import(
			"/Implementation/main/syntax-overlay-controller.js");
		install(linkCore);
		const surface = document.createElement("div");
		surface.style.cssText = "position:relative;width:500px;height:200px";
		const editor = document.createElement("textarea");
		editor.value = "const first = 1";
		surface.append(editor);
		document.body.append(surface);
		const overlay = new SyntaxOverlayController(
			linkCore, editor, surface);
		overlay.setDocument("change-1", "sample.js");
		overlay.enable();
		editor.value = "let second = 2";
		overlay.onInput();
	});
	await expect(page.locator("#pr11SyntaxOverlay:not([hidden])"))
		.toBeVisible();
	await expect(page.locator(
		"#pr11SyntaxOverlay .pm-token-keyword")).toContainText("let");
	await expect(page.locator("#pr11SyntaxOverlay")).not
		.toContainText("first");
});
