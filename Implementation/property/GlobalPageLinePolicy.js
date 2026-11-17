/**
 * Global page-line locator for immutable UTF-8 file windows.
 *
 * LF is 0x0A in UTF-8 and a CRLF pair contains one LF.
 * Dirty page metadata replaces the original page's LF count without
 * reading uncommitted text into the locator. Every source read is
 * bounded to one source page and yields cooperatively.
 */
export const GlobalPageLinePolicy = Object.freeze({
  readBatchBytes: 1024 * 1024,
  async locate({ file, targetLine, pageBytes, edits = new Map(),
    onProgress = () => {} }) {
    if (!(file instanceof Blob) ||
        !Number.isSafeInteger(targetLine) || targetLine < 1 ||
        !Number.isSafeInteger(pageBytes) || pageBytes < 1024 ||
        pageBytes > 1024 * 1024 || !(edits instanceof Map)) {
      const error = new RangeError("Invalid global line seek");
      error.status = 400;
      throw error;
    }
    const pages = Math.max(1, Math.ceil(file.size / pageBytes));
    let firstLine = 1;
    let batch = new Uint8Array(0);
    let batchStart = 0;
    for (let index = 0; index < pages; index++) {
      const start = index * pageBytes;
      const end = Math.min(file.size, start + pageBytes);
      const record = edits.get(index);
      let lineBreaks = record?.editedLineBreaks;
      let endsWithLF = record?.endsWithLF;
      if (!Number.isSafeInteger(lineBreaks) || lineBreaks < 0 ||
          typeof endsWithLF !== "boolean") {
        // Do not decode file contents or materialize the whole Blob.
        if (start < batchStart ||
            end > batchStart + batch.length) {
          batchStart = start;
          batch = new Uint8Array(await file.slice(start,
            Math.min(file.size, start +
              Math.max(pageBytes, this.readBatchBytes))).arrayBuffer());
        }
        const bytes = batch.subarray(
          start - batchStart, end - batchStart);
        if (bytes.length !== end - start) {
          const error = new Error("Incomplete page-line scan");
          error.status = 422;
          throw error;
        }
        lineBreaks = 0;
        for (const byte of bytes) if (byte === 10) lineBreaks++;
        endsWithLF = bytes.at(-1) === 10;
      }
      const lastLine = firstLine + lineBreaks;
      const nextStartsHere = targetLine === lastLine &&
        endsWithLF && index < pages - 1;
      if (targetLine >= firstLine && targetLine <= lastLine &&
          !nextStartsHere) {
        return { index, firstLine,
          localLine: targetLine - firstLine + 1 };
      }
      firstLine = lastLine;
      if (index % 8 === 7) {
        onProgress(Math.min(99, Math.round(
          100 * (index + 1) / pages)));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    const error = new RangeError("Global line out of range");
    error.status = 416;
    throw error;
  }
});
