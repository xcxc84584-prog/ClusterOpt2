/** PR9: bounded navigation within a resident editor page. */
export const GoToLinePolicy = Object.freeze({
  resolve({ text, firstLine = 1, targetLine, lineHeight }) {
    if (typeof text !== "string" ||
        !Number.isSafeInteger(firstLine) || firstLine < 1 ||
        !Number.isSafeInteger(targetLine) || targetLine < 1 ||
        !Number.isFinite(lineHeight) || lineHeight <= 0) {
      const error = new RangeError("Invalid line navigation");
      error.status = 400;
      throw error;
    }
    let localLine = 1;
    let offset = 0;
    const relative = targetLine - firstLine + 1;
    if (relative < 1) {
      const error = new RangeError("Line is outside the loaded page");
      error.status = 416;
      throw error;
    }
    while (localLine < relative && offset < text.length) {
      const next = text.indexOf("\n", offset);
      if (next < 0) break;
      offset = next + 1;
      localLine++;
    }
    if (localLine !== relative) {
      const error = new RangeError("Line is outside the loaded page");
      error.status = 416;
      throw error;
    }
    return {
      offset,
      scrollTop: Math.max(0, (localLine - 1) * lineHeight)
    };
  }
});
