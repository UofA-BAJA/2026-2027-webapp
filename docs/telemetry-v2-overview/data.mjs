// Everything the overview (PDF and PPTX) quotes from the repo, read fresh on every build so it stays real:
// code snippets, the README recipes and folder notes, the file tree with line counts, and the open values.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = new URL("../../", import.meta.url).pathname;
const TV2 = join(ROOT, "frontend/src/telemetry-v2");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
export const DATE = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

// ---- real code, cut from the files ----
function block(text, start, end) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => l.startsWith(start));
  if (i < 0) throw new Error(`snippet start not found: ${start}`);
  const j = lines.findIndex((l, k) => k > i && l.startsWith(end));
  return lines.slice(i, j + 1).join("\n");
}
const channels = read("frontend/src/telemetry-v2/config/channels.ts");
export const snipChannel = block(channels, "  cvt_temp: {", "  },");
export const snipPreset = block(read("frontend/src/telemetry-v2/config/presets.ts"), "  {", "  },"); // the first preset: overview
export const snipColors = block(read("frontend/src/telemetry-v2/styles/tokens.css"), "  /* ---- colors with a meaning", "  --press:");

// Code as typed tokens (one pass, so no rule matches inside another's output): c comment, s string, h hex color, n number, t text.
export function tokenize(code) {
  const out = [];
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("[^"\n]*")|(#[0-9a-fA-F]{6}\b)|((?<![\w#-])-?\d+(?:\.\d+)?(?![\w%]))/g;
  let last = 0;
  for (const m of code.matchAll(re)) {
    if (m.index > last) out.push({ kind: "t", text: code.slice(last, m.index) });
    out.push({ kind: m[1] ? "c" : m[2] ? "s" : m[3] ? "h" : "n", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ kind: "t", text: code.slice(last) });
  return out;
}

// ---- README ----
const readme = read("frontend/src/telemetry-v2/README.md");
// inline markdown → segments { text, code?, bold? }
export function inline(s) {
  const out = [];
  for (const m of s.matchAll(/`([^`]+)`|\*\*([^*]+)\*\*|([^`*]+|\*)/g))
    out.push(m[1] !== undefined ? { text: m[1], code: true } : m[2] !== undefined ? { text: m[2], bold: true } : { text: m[3] });
  return out;
}
// recipes → [{ title, blocks: [{ type: "p" | "ol" | "ul", sub, segs }] }]
export const recipes = readme
  .split("## Recipes")[1]
  .split("## Self-checks")[0]
  .split("\n### ")
  .slice(1)
  .map((chunk) => {
    const [title, ...body] = chunk.trim().split("\n");
    const blocks = [];
    for (const line of body) {
      const m = line.match(/^(\s*)(\d+\.|-) (.*)$/);
      if (m) blocks.push({ type: m[2] === "-" ? "ul" : "ol", sub: !!m[1], segs: inline(m[3]) });
      else if (line.trim()) blocks.push({ type: "p", segs: inline(line) });
    }
    return { title, blocks };
  });
// the "Where things live" table: folder → first clause of its description
export const folders = Object.fromEntries(
  [...readme.matchAll(/^\| `([^`]+)\/?` \| (.+?) \|$/gm)].map(([, k, v]) => [k.replace(/\/$/, ""), v.split(":")[0].replace(/\.$/, "")]),
);

// ---- file tree with line counts ----
const count = (f) => {
  const t = readFileSync(f, "utf8");
  return t.split("\n").length - (t.endsWith("\n") ? 1 : 0);
};
function tree(dir) {
  return readdirSync(dir)
    .filter((n) => n !== "assets")
    .sort()
    .flatMap((n) => {
      const f = join(dir, n);
      return statSync(f).isDirectory() ? tree(f) : /\.(tsx?|css|md)$/.test(n) ? [{ path: relative(TV2, f), lines: count(f) }] : [];
    });
}
export const files = tree(TV2);
export const groups = {};
for (const f of files) (groups[f.path.includes("/") ? f.path.split("/").slice(0, -1).join("/") : "."] ??= []).push(f);
export const biggest = files.filter((f) => !f.path.endsWith(".md")).reduce((a, b) => (b.lines > a.lines ? b : a));

// ---- still open: every TODO and every confirmed limit in channels.ts ----
export const open = [];
let ch = "";
for (const line of channels.split("\n")) {
  const head = line.match(/^ {2}(\w+): \{/);
  if (head) ch = head[1];
  const label = line.match(/label: "([^"]+)"/);
  if (label) ch = label[1];
  const f = line.match(/^\s+(\w+): (.+?),\s*\/\/\s*(.*)$/);
  if (!f || !/TODO|confirmed/.test(f[3])) continue;
  const [, field, value, note] = f;
  open.push({
    ch,
    field,
    value: value.replace(/^\{ min: (.*), max: (.*) \}$/, "$1 – $2"),
    status: /TODO/.test(note) ? "to confirm" : "confirmed",
    note: note.replace(/\.?\s*TODO:.*$/, "").replace(/^TODO:.*$/, ""),
  });
}
// the real comment in sendCommand.ts about the missing endpoint
export const noEndpoint = read("frontend/src/telemetry-v2/radio/sendCommand.ts").match(/\/\/ (No such endpoint exists yet[^\n]*)/)[1];
