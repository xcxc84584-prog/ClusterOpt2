/**
 * Shared PR8 viewport geometry: measure the actual editor rather than
 * assuming fixed font sizes, padding, or scroll positions.
 */
export const EditorViewportPolicy = Object.freeze({
  guidePosition({ scrollTop, scrollLeft, lineHeight, paddingTop,
    paddingLeft }) {
    const height = Math.max(1, Number(lineHeight) || 1);
    const top = Number(paddingTop) || 0;
    const left = Number(paddingLeft) || 0;
    return {
      top: top - (((Number(scrollTop) || 0) % height) + height) % height,
      paddingLeft: left - (Number(scrollLeft) || 0)
    };
  },
  progress(status, progress) {
    const colors = new Set(["green", "yellow", "red", "blue"]);
    const state = colors.has(status) ? status : "red";
    const amount = Number.isFinite(progress) ? progress : 0;
    return {
      status: state,
      percent: Math.max(0, Math.min(100, amount)),
      label: state === "blue"
    };
  }
});
