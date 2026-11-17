/**
 * OCDA sample: bounded, multi-language tokenizer plugin.
 * Inspired by highlight.js language grammars (BSD-3-Clause).
 * This is an independent implementation, not copied upstream code.
 */
const LANGUAGES = Object.freeze({
  js: ["js","jsx","mjs","cjs","javascript"],
  ts: ["ts","tsx","typescript"],
  py: ["py","python"],
  cpp: ["cpp","cc","cxx","hpp","h","c"],
  java: ["java"],
  css: ["css","scss"],
  html: ["html","htm","xml"],
  json: ["json"],
  sql: ["sql"]
});
const KEYWORDS = Object.freeze({
  js: "const let var function return if else for while class new import export async await try catch throw typeof instanceof this null undefined true false",
  ts: "const let var function return if else for while class new import export async await interface type enum extends implements readonly public private protected string number boolean void",
  py: "def class return if elif else for while in not and or is import from as async await try except finally raise with yield True False None lambda",
  cpp: "int long short float double char bool void auto const constexpr static class struct public private protected template typename namespace include return if else for while new delete true false nullptr",
  java: "class interface extends implements public private protected static final void int long double boolean String return if else for while new null true false package import",
  css: "@media @import @supports !important",
  html: "",
  json: "true false null",
  sql: "SELECT FROM WHERE JOIN LEFT RIGHT INNER OUTER ON GROUP BY ORDER HAVING LIMIT INSERT INTO VALUES UPDATE DELETE CREATE TABLE NULL AND OR AS DISTINCT"
});
const LIMIT = 65536;
function languageOf(name) {
  const extension = String(name ?? "").toLowerCase()
    .replace(/^.*\./,"");
  return Object.keys(LANGUAGES).find(key =>
    LANGUAGES[key].includes(extension)) ?? null;
}
function tokenize(source, fileName = "example.js") {
  if (typeof source !== "string" || source.length > LIMIT) {
    return { ok: false, status: 413, error: "Invalid or oversized text" };
  }
  const language = languageOf(fileName);
  if (!language) {
    return { ok: true, status: 200, value: {
      language: "plaintext", tokens: [{type:"plain",text:source}]
    }};
  }
  const tokens = [];
  const keywords = new Set(KEYWORDS[language].split(" ").filter(Boolean)
    .map(word => language === "sql" ? word.toLowerCase() : word));
  const pattern = /(?:\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|#[^\n]*|--[^\n]*|"(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|\s+|[^\sA-Za-z_$\d])/gy;
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    const raw = match ? match[0] : source[offset];
    if (!raw) break;
    offset += raw.length;
    let type = "plain";
    if (/^(?:\/\*|\/\/|#|--)/.test(raw) &&
        !(language === "css" && raw.startsWith("#")) &&
        !(language === "html" && raw.startsWith("#"))) type = "comment";
    else if (/^["'`]/.test(raw)) type = "string";
    else if (/^\d/.test(raw)) type = "number";
    else if (keywords.has(language === "sql" ? raw.toLowerCase() : raw))
      type = "keyword";
    else if (/^[{}()[\].,;:=+*\/<>&|!?%-]$/.test(raw))
      type = "operator";
    const previous = tokens[tokens.length - 1];
    if (previous?.type === type) previous.text += raw;
    else tokens.push({type,text:raw});
    if (tokens.length > LIMIT) {
      return {ok:false,status:413,error:"Token budget exceeded"};
    }
  }
  return {ok:true,status:200,value:{language,tokens}};
}
export const multilangHighlighter = Object.freeze({
  id:"cluster.sample.multilang-highlighter",
  version:"1.0.0",
  languages:LANGUAGES,
  tokenize
});
export function install(core) {
  const id = "SampleMultiLanguageHighlighter";
  const existing = core.uru.objects.get(id);
  if (existing) return {ok:true,status:200,alreadyInstalled:true};
  const object = {
    id,
    strictOCDA:true,
    ocda:{
      EHU:[],Log:[],Request:["highlight"],Response:[],
      UserAPI:["highlight"],AgentAPI:[],Property:[],Program:[]
    },
    authorization:{default:"Public"},
    receive(action,payload) {
      if (action !== "highlight") {
        return {ok:false,status:404};
      }
      const result=tokenize(payload?.text,payload?.fileName);
      if (!result.ok) {
        const error=new Error(result.error);
        error.status=result.status;
        throw error;
      }
      return result.value;
    }
  };
  if (!core.register(object)) return {ok:false,status:409};
  const manifest = {
    manifestVersion:1,
    providerId:"cluster.sample.multilang-highlighter",
    objectId:id,
    provides:[{
      service:"editor.syntax.highlight",
      action:"highlight",
      version:"1.0.0",
      inputSchema:{type:"object",properties:{
        text:{type:"string"},fileName:{type:"string"}
      },required:["text","fileName"]},
      outputSchema:{type:"object",properties:{
        language:{type:"string"},tokens:{type:"array"}
      },required:["language","tokens"]}
    }],
    requires:[],permissions:[],
    execution:{isolation:"host",concurrency:"per-slice"}
  };
  const registered = core.registerProvider(id,manifest);
  if (!registered.ok) {
    core.unregister(id);
    return registered;
  }
  return {ok:true,status:201,providerId:manifest.providerId};
}
