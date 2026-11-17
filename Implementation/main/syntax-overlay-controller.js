/**
 * PR11: bounded viewport-only syntax overlay for the native textarea.
 * All tokenization requests pass through HubUnit. The textarea remains the
 * sole editable source; the overlay is decorative and has no input handlers.
 */
export class SyntaxOverlayController {
	constructor(core, editor, surface) {
		this.core = core;
		this.editor = editor;
		this.surface = surface;
		this.enabled = false;
		this.serial = 0;
		this.frame = 0;
		this.composing = false;
		this.documentKey = "";
		this.fileName = "";
		this.lineCache = null;
		this.lineText = null;
		this.container = editor.ownerDocument.createElement("pre");
		this.container.id = "pr11SyntaxOverlay";
		this.container.setAttribute("aria-hidden", "true");
		this.content = editor.ownerDocument.createElement("div");
		this.content.className = "syntax-visible-lines";
		this.container.append(this.content);
		surface.append(this.container);
		this.container.hidden = true;
	}

	enable() {
		this.enabled = true;
		this.schedule(true);
	}

	disable() {
		this.enabled = false;
		this.serial++;
		this.container.hidden = true;
		this.editor.classList.remove("syntax-overlay-active");
	}

	/** Called after render and editor input; never changes editor value. */
	schedule(force = false) {
		this.serial++;
		this.container.hidden = true;
		this.editor.classList.remove("syntax-overlay-active");
		if (!this.enabled || this.composing || this.editor.hidden ||
			this.surface.hidden) return;
		if (this.frame && !force) return;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			void this.refresh();
		});
	}

	/**
	 * Index only modest loaded pages. On huge pages, fall back to native
	 * text instead of blocking the editing thread on a full-file scan.
	 */
	buildLines(source) {
		if (source.length > 1048576) return null;
		if (this.lineText === source && this.lineCache) {
			return this.lineCache;
		}
		const offsets = [0];
		for (let index = 0; index < source.length; index++) {
			if (source.charCodeAt(index) === 10) offsets.push(index + 1);
		}
		this.lineText = source;
		this.lineCache = offsets;
		return offsets;
	}

	async refresh() {
		const ticket = this.serial;
		const source = this.editor.value;
		const offsets = this.buildLines(source);
		if (!offsets || !this.fileName || !this.enabled ||
			this.composing || this.surface.hidden) return;

		const style = getComputedStyle(this.editor);
		const lineHeight = parseFloat(style.lineHeight) || 22;
		const first = Math.max(0, Math.min(
			offsets.length - 1,
			Math.floor(this.editor.scrollTop / lineHeight)));
		const count = Math.min(160, Math.max(1,
			Math.ceil(this.editor.clientHeight / lineHeight) + 2));
		const end = Math.min(offsets.length, first + count);
		const startOffset = offsets[first];
		const endOffset = end < offsets.length ?
			offsets[end] : source.length;
		const text = source.slice(startOffset, endOffset);
		if (text.length > 65536) return;

		const result = await this.core.requestService(
			"ui", "editor.syntax.highlight", "highlight", {
				fileName: this.fileName, text
			}, {origin: "user"});
		if (this.serial !== ticket || !this.enabled ||
			this.editor.value !== source || this.composing) return;
		const tokens = result.value?.tokens;
		if (!result.ok || !Array.isArray(tokens) ||
			tokens.map(item => item.text).join("") !== text) return;

		const allowed = new Set([
			"keyword", "string", "number", "comment",
			"operator", "plain"
		]);
		const fragment = this.editor.ownerDocument.createDocumentFragment();
		for (const token of tokens) {
			if (!allowed.has(token.type) ||
				typeof token.text !== "string") return;
			const part = this.editor.ownerDocument.createElement("span");
			part.className = "pm-token-" + token.type;
			part.textContent = token.text;
			fragment.append(part);
		}
		this.content.replaceChildren(fragment);
		this.align(style, first, lineHeight);
		this.container.hidden = false;
		this.editor.classList.add("syntax-overlay-active");
	}

	align(style, first, lineHeight) {
		const editor = this.editor;
		this.container.style.left = editor.offsetLeft + "px";
		this.container.style.top = editor.offsetTop + "px";
		this.container.style.width = editor.clientWidth + "px";
		this.container.style.height = editor.clientHeight + "px";
		this.container.style.font = style.font;
		this.container.style.lineHeight = style.lineHeight;
		this.container.style.tabSize = style.tabSize;
		this.content.style.paddingLeft = style.paddingLeft;
		this.content.style.paddingTop =
			(parseFloat(style.paddingTop) || 0) +
			first * lineHeight - editor.scrollTop + "px";
		this.content.style.transform =
			"translateX(" + (-editor.scrollLeft) + "px)";
	}

	setDocument(documentKey, fileName) {
		if (this.documentKey !== documentKey ||
			this.fileName !== fileName) {
			this.documentKey = documentKey;
			this.fileName = fileName || "";
			this.lineCache = null;
			this.lineText = null;
		}
		this.schedule();
	}

	onInput() {
		this.schedule();
	}

	onScroll() {
		this.schedule();
	}

	onCompositionStart() {
		this.composing = true;
		this.schedule();
	}

	onCompositionEnd() {
		this.composing = false;
		this.schedule(true);
	}
}
