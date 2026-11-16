/**
 * PR2 single source of truth for interface RGB and token derivation.
 * This Property owns validation and algorithms; UI is only a consumer.
 */
const TOKENS = Object.freeze([
	"background", "surface", "panel", "control", "hover",
	"border", "text", "muted", "editor", "gutter", "accent",
	"text-on-surface", "text-on-panel", "text-on-control"
]);

export const UI_COLOR = Object.freeze({
	defaultRGB: Object.freeze([0, 0, 0]),
	storageKey: "clusteropt2.ui_color.v1",
	tokens: TOKENS,

	valid(value) {
		return Array.isArray(value) && value.length === 3 &&
			value.every(channel => Number.isInteger(channel) &&
				channel >= 0 && channel <= 255);
	},

	fromHex(hex) {
		if (typeof hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(hex)) {
			throw new RangeError("Invalid RGB color");
		}
		return [1, 3, 5].map(index =>
			Number.parseInt(hex.slice(index, index + 2), 16));
	},

	toHex(rgb) {
		if (!this.valid(rgb)) throw new RangeError("Invalid RGB channels");
		return "#" + rgb.map(x => x.toString(16).padStart(2, "0"))
			.join("").toUpperCase();
	},

	derive(rgb) {
		if (!this.valid(rgb)) throw new RangeError("Invalid RGB channels");
		// Match ClusterOpt's original dark palette exactly at RGB(0,0,0).
		if (rgb.every(channel => channel === 0)) {
			return Object.freeze({
				mode: "dark",
				background: "rgb(0, 0, 0)",
				surface: "rgb(32, 33, 39)",
				panel: "rgb(17, 18, 22)",
				control: "rgb(52, 54, 64)",
				hover: "rgb(71, 74, 88)",
				border: "rgb(60, 62, 73)",
				text: "rgb(241, 242, 245)",
				muted: "rgb(165, 168, 181)",
				editor: "rgb(0, 0, 0)",
				gutter: "rgb(8, 9, 11)",
				accent: "rgb(122, 175, 255)",
				"text-on-surface": "rgb(241, 242, 245)",
				"text-on-panel": "rgb(241, 242, 245)",
				"text-on-control": "rgb(241, 242, 245)"
			});
		}
		const dark = (rgb[0] * 0.2126 + rgb[1] * 0.7152 +
			rgb[2] * 0.0722) < 145;
		const clamp = value => Math.min(255, Math.max(0, Math.round(value)));
		const mix = (base, target, ratio) =>
			base.map((value, index) =>
				clamp(value * (1 - ratio) + target[index] * ratio));
		const rgbText = values => "rgb(" + values.join(", ") + ")";
		const black = [0, 0, 0];
		const white = [255, 255, 255];
		const contrast = dark ? white : black;
		const move = dark ? white : black;
		const make = ratio => rgbText(mix(rgb, move, ratio));
		const text = rgbText(contrast);
		return Object.freeze({
			mode: dark ? "dark" : "light",
			background: rgbText(rgb),
			surface: make(dark ? 0.13 : 0.08),
			panel: make(dark ? 0.08 : 0.04),
			control: make(dark ? 0.22 : 0.14),
			hover: make(dark ? 0.30 : 0.22),
			border: make(dark ? 0.24 : 0.22),
			text,
			muted: make(dark ? 0.67 : 0.52),
			editor: rgbText(rgb),
			gutter: make(dark ? 0.035 : 0.035),
			accent: dark ? "rgb(122, 175, 255)" : "rgb(34, 82, 175)",
			"text-on-surface": text,
			"text-on-panel": text,
			"text-on-control": text
		});
	}
});
