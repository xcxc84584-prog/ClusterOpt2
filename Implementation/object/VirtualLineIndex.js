/**
 * Virtual line-to-byte locator. Stores Blob + sparse checkpoints,
 * never the full decoded document. Line addresses are exact for LF
 * and CRLF UTF-8 text; indexed positions survive cache demotion.
 */
export class VirtualLineIndex {
  constructor(core) {
    this.id = "virtual-line-index";
    this.core = core;
    this.documents = new Map();
    this.strictOCDA = true;
    this.authorization = Object.freeze({ default: "Public" });
    const actions = ["open", "locate", "range", "describe"];
    this.ocda = Object.freeze({
      Request: actions, Response: actions, UserAPI: actions,
      AgentAPI: [], Property: ["LineAddressPolicy"],
      Program: "VirtualLineIndex", EHU: "LinkCore.OMU",
      Log: "LinkCore.OMU"
    });
    if (!core.register(this)) {
      throw new Error("VirtualLineIndex registration failed");
    }
  }

  policy() {
    return this.core.readProperty(this.id, "LineAddressPolicy").value;
  }

  error(message, status) {
    const error = new Error(message);
    error.status = status;
    throw error;
  }

  document(id) {
    const document = this.documents.get(id);
    if (!document) this.error("Unknown indexed document", 404);
    return document;
  }

  describe(doc) {
    return {
      id: doc.id, byteLength: doc.blob.size,
      indexedThroughLine: doc.high.line,
      indexedThroughByte: doc.high.offset,
      checkpointCount: doc.checkpoints.length,
      totalLines: doc.eof ? doc.high.line : null
    };
  }

  async locate(doc, line) {
    this.policy().checkLine(line);
    if (line === 1) return 0;
    if (doc.eof && line > doc.high.line) {
      this.error("Line out of range", 416);
    }
    const forward = line > doc.high.line;
    const anchor = forward ? doc.high :
      this.policy().anchor(doc.checkpoints, line);
    if (anchor.line === line) return anchor.offset;
    const checkpoints = [];
    const result = await this.policy().scan(doc.blob, anchor, line,
      item => { if (forward) checkpoints.push(item); });
    if (forward) {
      doc.high = { line: result.line, offset: result.offset };
      doc.checkpoints.push(...checkpoints);
      if (result.eof) doc.eof = true;
    }
    if (result.line !== line) this.error("Line out of range", 416);
    return result.offset;
  }

  async receive(action, payload = {}) {
    if (action === "open") {
      const { id, blob } = payload;
      if (typeof id !== "string" ||
          !/^[a-zA-Z0-9_-]{1,64}$/.test(id) ||
          !(blob instanceof Blob)) {
        this.error("Invalid indexed Blob", 400);
      }
      if (this.documents.has(id)) this.error("Index already open", 409);
      const document = {
        id, blob, high: { line: 1, offset: 0 },
        checkpoints: [{ line: 1, offset: 0 }],
        eof: blob.size === 0
      };
      this.documents.set(id, document);
      return this.describe(document);
    }
    const doc = this.document(payload.id);
    if (action === "describe") return this.describe(doc);
    if (action === "locate") {
      return { line: payload.line,
        byteOffset: await this.locate(doc, payload.line) };
    }
    if (action === "range") {
      const { firstLine, lastLine } = payload;
      this.policy().checkRange(firstLine, lastLine);
      const start = await this.locate(doc, firstLine);
      let end;
      try {
        end = await this.locate(doc, lastLine + 1);
      } catch (error) {
        if (error.status !== 416) throw error;
        end = doc.blob.size;
      }
      return { start, end, firstLine, lastLine,
        byteLength: doc.blob.size };
    }
    this.error("Unknown line index action", 400);
  }
}
