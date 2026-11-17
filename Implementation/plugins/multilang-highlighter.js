/**
 * OCDA PR11: bounded deterministic multi-language lexer.
 * Design references: highlight.js grammars and Prism tokens.
 * This is original code; no upstream source is embedded.
 */
const MAX_TEXT = 65536;
const OBJECT_ID = "SampleMultiLanguageHighlighter";
const PROVIDER_ID = "cluster.sample.multilang-highlighter";
const SERVICE_ID = "editor.syntax.highlight";

const EXTENSIONS = Object.freeze({
	js: ["js", "jsx", "mjs", "cjs"],
	ts: ["ts", "tsx"],
	py: ["py"],
	cpp: ["c", "h", "cc", "cpp", "cxx", "hpp"],
	java: ["java"],
	css: ["css", "scss"],
	html: ["htm", "html", "xml"],
	json: ["json"],
	sql: ["sql"]
});

const WORDS = Object.freeze({
	js: "const let var function return if else for while class new import " +
		"export async await try catch throw typeof instanceof this null " +
		"undefined true false switch case break continue",
	ts: "const let var function return if else for while class new import " +
		"export async await interface type enum extends implements readonly " +
		"public private protected string number boolean void true false",
	py: "def class return if elif else for while in not and or is import " +
		"from as async await try except finally raise with yield True False " +
		"None lambda pass",
	cpp: "int long short float double char bool void auto const constexpr " +
		"static class struct public private protected template typename " +
		"namespace return if else for while new delete true false nullptr " +
		"include",
	java: "class interface extends implements public private protected static " +
		"final void int long double boolean String return if else for while " +
		"new null true false package import",
	css: "@media @import @supports !important",
	html: "",
	json: "true false null",
	sql: "SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER " +
		"HAVING LIMIT INSERT INTO VALUES UPDATE DELETE CREATE TABLE NULL AND " +
		"OR AS DISTINCT"
});

const ALIASES = Object.freeze({
	javascript: "js", typescript: "ts", python: "py",
	c: "cpp", "c++": "cpp", xml: "html", scss: "css"
});

const KEYWORDS = Object.freeze(Object.fromEntries(
	Object.entries(WORDS).map(([language, value]) => [
		language, new Set(value.split(" ").filter(Boolean).map(word =>
			language === "sql" ? word.toLowerCase() : word))
	])
));

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMBER = /^(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?)/;
const SPACE = /^\s+/;

export function resolveLanguage(fileName) {
	const name = String(fileName ?? "").toLowerCase();
	if (Object.hasOwn(EXTENSIONS, name)) return name;
	if (Object.hasOwn(ALIASES, name)) return ALIASES[name];
	const extension = name.split(/[\\/]/).pop().split(".").pop();
	return Object.keys(EXTENSIONS).find(language =>
		EXTENSIONS[language].includes(extension)) ?? "plaintext";
}

/**
 * Every emitted token reconstructs its source exactly; no HTML is produced.
 * Comments are recognized only for their corresponding language family.
 */
export function tokenize(source, fileName = "example.js") {
	if (typeof source !== "string") {
		return {ok: false, status: 400, error: "Expected text"};
	}
	if (source.length > MAX_TEXT) {
		return {ok: false, status: 413, error: "Text exceeds budget"};
	}
	const language = resolveLanguage(fileName);
	const tokens = [];
	const emit = (type, text) => {
		if (!text) return;
		const last = tokens[tokens.length - 1];
		if (last && last.type === type) last.text += text;
		else tokens.push({type, text});
	};
	const supportsBlock = ["js", "ts", "cpp", "java", "css"].includes(language);
	const supportsSlash = ["js", "ts", "cpp", "java"].includes(language);
	const supportsHash = language === "py";
	const supportsDash = language === "sql";
	const supportsQuotes = language !== "plaintext";
	let index = 0;

	while (index < source.length) {
		const rest = source.slice(index);
		const advance = (type, length) => {
			emit(type, source.slice(index, index + length));
			index += length;
		};
		if (supportsBlock && rest.startsWith("/*")) {
			const close = source.indexOf("*/", index + 2);
			advance("comment", close < 0 ? source.length - index :
				close + 2 - index);
			continue;
		}
		if ((supportsSlash && rest.startsWith("//")) ||
			(supportsHash && rest[0] === "#") ||
			(supportsDash && rest.startsWith("--"))) {
			const end = source.indexOf("\n", index);
			advance("comment", end < 0 ? source.length - index : end - index);
			continue;
		}
		if (supportsQuotes && /['"\x60]/.test(rest[0]) &&
			(language !== "json" || rest[0] === '"') &&
			(language !== "html" || rest[0] !== "\x60")) {
			const quote = rest[0];
			let cursor = index + 1;
			while (cursor < source.length) {
				if (source[cursor] === "\\") {
					cursor += Math.min(2, source.length - cursor);
				} else if (source[cursor++] === quote) {
					break;
				} else if (quote !== "\x60" &&
					(language === "js" || language === "ts" ||
					language === "json") && source[cursor - 1] === "\n") {
					break;
				}
			}
			advance("string", cursor - index);
			continue;
		}
		if (language === "html" && rest.startsWith("<!--")) {
			const end = source.indexOf("-->", index + 4);
			advance("comment", end < 0 ? source.length - index :
				end + 3 - index);
			continue;
		}
		const word = IDENTIFIER.exec(rest)?.[0];
		if (word) {
			const normalized = language === "sql" ? word.toLowerCase() : word;
			advance(KEYWORDS[language]?.has(normalized) ?
				"keyword" : "plain", word.length);
			continue;
		}
		const number = NUMBER.exec(rest)?.[0];
		if (number) {
			advance("number", number.length);
			continue;
		}
		const spaces = SPACE.exec(rest)?.[0];
		if (spaces) {
			advance("plain", spaces.length);
			continue;
		}
		advance(language !== "plaintext" &&
			/[()[\]{}:;,.=+\-*\/<>!%&|?]/.test(rest[0]) ?
			"operator" : "plain", 1);
	}
	return {ok: true, status: 200, value: {language, tokens}};
}

export const multilangHighlighter = Object.freeze({
	id: PROVIDER_ID,
	version: "1.1.0",
	languages: EXTENSIONS,
	tokenize
});

/** The host owns registration; no direct plugin access to DOM or storage. */
export function install(core) {
	if (!core || typeof core.register !== "function" ||
		typeof core.registerProvider !== "function" ||
		typeof core.unregister !== "function" ||
		!core.uru?.objects) return {ok: false, status: 400};

	const current = core.uru.objects.get(OBJECT_ID);
	if (current) {
		return core.uru.getProvider(PROVIDER_ID)?.objectId === OBJECT_ID ?
			{ok: true, status: 200, alreadyInstalled: true} :
			{ok: false, status: 409};
	}
	const object = {
		id: OBJECT_ID,
		strictOCDA: true,
		ocda: {
			EHU: [], Log: [], Request: ["highlight"], Response: [],
			UserAPI: ["highlight"], AgentAPI: [], Property: [], Program: []
		},
		authorization: {default: "Public"},
		receive(action, payload) {
			if (action !== "highlight") {
				const error = new Error("Unknown action");
				error.status = 404;
				throw error;
			}
			const result = tokenize(payload?.text, payload?.fileName);
			if (!result.ok) {
				const error = new Error(result.error);
				error.status = result.status;
				throw error;
			}
			return result.value;
		}
	};
	if (!core.register(object)) return {ok: false, status: 409};

	const manifest = {
		manifestVersion: 1,
		providerId: PROVIDER_ID,
		objectId: OBJECT_ID,
		provides: [{
			service: SERVICE_ID, action: "highlight", version: "1.1.0",
			inputSchema: {
				type: "object",
				properties: {
					text: {type: "string"},
					fileName: {type: "string"}
				},
				required: ["text", "fileName"]
			},
			outputSchema: {
				type: "object",
				properties: {
					language: {type: "string"},
					tokens: {
						type: "array",
						items: {
							type: "object",
							properties: {
								type: {type: "string"},
								text: {type: "string"}
							},
							required: ["type", "text"]
						}
					}
				},
				required: ["language", "tokens"]
			}
		}],
		requires: [], permissions: [],
		execution: {isolation: "host", concurrency: "per-slice"}
	};
	const registered = core.registerProvider(OBJECT_ID, manifest);
	if (!registered.ok) {
		core.unregister(OBJECT_ID);
		return registered;
	}
	return {ok: true, status: 201, providerId: PROVIDER_ID};
}
