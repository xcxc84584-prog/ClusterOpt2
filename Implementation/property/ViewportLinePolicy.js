/**
 * Convert browser viewport pixels to 1-based logical text-line addresses.
 * Geometry is measured by the host; zoom is reflected by computed lineHeight.
 * No proportional file-size estimate or document text scan is permitted.
 */
export const ViewportLinePolicy = Object.freeze({
  maxVisibleLines: 8192,

  range({ scrollTop, clientHeight, lineHeight, maxLine = null }) {
    const values = [scrollTop, clientHeight, lineHeight];
    if (values.some(value => !Number.isFinite(value)) ||
        scrollTop < 0 || clientHeight <= 0 || lineHeight <= 0) {
      const error = new RangeError("Invalid viewport geometry");
      error.status = 400;
      throw error;
    }

    if (maxLine !== null &&
        (!Number.isSafeInteger(maxLine) || maxLine < 1)) {
      const error = new RangeError("Invalid viewport line limit");
      error.status = 400;
      throw error;
    }
    const first = Math.floor(scrollTop / lineHeight) + 1;
    const last = Math.max(first,
      Math.ceil((scrollTop + clientHeight) / lineHeight));
    const firstLine = maxLine === null ? first : Math.min(first, maxLine);
    const lastLine = maxLine === null ? last : Math.min(last, maxLine);
    if (!Number.isSafeInteger(firstLine) ||
        !Number.isSafeInteger(lastLine) ||
        lastLine - firstLine >= this.maxVisibleLines) {
      const error = new RangeError("Viewport line range exceeds limits");
      error.status = 400;
      throw error;
    }
    return { firstLine, lastLine };
  }
});
