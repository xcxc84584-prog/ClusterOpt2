/**
 * PR01 sparse-file address and bounded UTF-8 read probe.
 * Uses real OS files but never materializes gigabytes of content.
 * Does not validate browser File System Access or large-file writeback.
 */
import { mkdtemp, open, rm } from "node:fs/promises";
import { openAsBlob } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { UTF8SlicePolicy } from "../property/UTF8SlicePolicy.js";

const MiB = 1024 ** 2;
const CASES = Object.freeze([1, 64, 1024, 5120]);
const EXPECTED_BYTES = 65536;

function ensure(condition, message) {
  if (!condition) throw new Error("Sparse file probe: " + message);
}
async function createSparseFile(path, size) {
  const file = await open(path, "wx");
  try {
    // Windows NTFS does not automatically mark offset-written files sparse.
    // Explicitly enable the filesystem flag; do not waive allocation checks.
    if (process.platform === "win32") {
      const sparse = spawnSync("fsutil", ["sparse", "setflag", path],
        { encoding: "utf8", windowsHide: true });
      ensure(sparse.status === 0, "unable to enable NTFS sparse flag");
    }
    const first = Buffer.from("OPEN");
    const last = Buffer.from("END");
    await file.write(first, 0, first.length, 0);
    await file.write(last, 0, last.length, size - last.length);
    const stat = await file.stat();
    ensure(stat.size === size, "file size mismatch");
    return {
      logicalBytes: stat.size,
      allocatedBytes: Number.isFinite(stat.blocks) ?
        stat.blocks * 512 : null
    };
  } finally {
    await file.close();
  }
}
/**
 * Positioned OS window adapter for Node hosts where openAsBlob cannot
 * reliably expose offsets above 4 GiB. The production slice policy still
 * validates UTF-8 and byte boundaries; this adapter cannot read unbounded.
 */
async function openBoundedFileSource(path, size) {
  const handle = await open(path, "r");
  return {
    blob: {
      size,
      slice(start, end) {
        ensure(Number.isSafeInteger(start) &&
          Number.isSafeInteger(end) && start >= 0 &&
          start <= end && end <= size, "invalid source range");
        const length = end - start;
        ensure(length <= UTF8SlicePolicy.maxChunkBytes + 4,
          "unbounded source read");
        return {
          async arrayBuffer() {
            const buffer = Buffer.alloc(length);
            let done = 0;
            while (done < length) {
              const result = await handle.read(buffer, done,
                length - done, start + done);
              ensure(result.bytesRead > 0, "unexpected source EOF");
              done += result.bytesRead;
            }
            return buffer.buffer.slice(buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength);
          }
        };
      }
    },
    close: () => handle.close()
  };
}

export async function runSparseProbe() {
  const dir = await mkdtemp(join(tmpdir(), "cluster-ocda-size-"));
  const rows = [];
  try {
    for (const mib of CASES) {
      const size = mib * MiB;
      const path = join(dir, String(mib) + ".bin");
      const info = await createSparseFile(path, size);
      // Node 22 openAsBlob can return an empty last slice > 4 GiB.
      // Keep native Blob coverage for smaller sizes, but use bounded
      // positioned reads for the 5 GiB case.
      const backend = size > 2 ** 32 ?
        "positioned-os-window" : "node-openAsBlob";
      const source = backend === "node-openAsBlob" ?
        { blob: await openAsBlob(path), close: async () => {} } :
        await openBoundedFileSource(path, size);
      const blob = source.blob;
      try {
        const chunk = UTF8SlicePolicy.defaultChunkBytes;
        const count = UTF8SlicePolicy.count(blob.size, chunk);
        const before = process.memoryUsage().heapUsed;
        const started = performance.now();
        const first = await UTF8SlicePolicy.read(blob, 0, chunk);
        const middle = await UTF8SlicePolicy.read(blob,
          Math.floor(count / 2), chunk);
        const last = await UTF8SlicePolicy.read(blob, count - 1, chunk);
        const elapsedMs = Math.round(performance.now() - started);
        const heapDelta = process.memoryUsage().heapUsed - before;
        ensure(first.text.startsWith("OPEN"), "first marker");
        ensure(last.text.endsWith("END"), "last marker");
        ensure(first.text.length <= EXPECTED_BYTES, "first chunk bound");
        ensure(middle.text.length <= EXPECTED_BYTES, "middle chunk bound");
        ensure(last.text.length <= EXPECTED_BYTES, "last chunk bound");
        ensure(last.end === blob.size, "large offset boundary");
        ensure(info.allocatedBytes === null ||
          info.allocatedBytes < 4 * MiB,
        "expected sparse backing allocation");
        rows.push({
          sizeMiB: mib, backend, ...info, sliceCount: count,
          inspectedBytes: first.end - first.start +
            middle.end - middle.start + last.end - last.start,
          elapsedMs, heapDeltaBytes: heapDelta,
          lastByteOffset: last.start
        });
      } finally {
        await source.close();
      }
    }
    return {
      schemaVersion: 1,
      kind: "real sparse filesystem + UTF8SlicePolicy read",
      cases: rows, pass: rows.length === CASES.length,
      limitations: [
        "Logical 5 GiB sparse files do not contain 5 GiB real data.",
        "Node Blob and positioned OS windows are different input adapters.",
        "No browser OPFS, File System Access permission, edit or writeback.",
        "Timing and heap delta are observations, not performance guarantees."
      ]
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
if (process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(JSON.stringify(await runSparseProbe(), null, 2) +
    "\n");
}
