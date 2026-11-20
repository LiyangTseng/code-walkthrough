#!/usr/bin/env node
// Build a code-walkthrough page: pull each source from git at the pinned SHA, check the walk against it,
// and inline everything into assets/player.html.
//
//   node build.mjs <walk.js> [--repo <git checkout>] [--out <page.html>]
//
// --repo defaults to the current directory; --out defaults to <walk dir>/<walk name>.html.
// Exits 1 on any error. Prints the fact-check list: every scene tagged "fact" with the lines it cites.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const walkPath = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!walkPath) { console.error("usage: node build.mjs <walk.js> [--repo <dir>] [--out <file>]"); process.exit(2); }
const walkFile = resolve(walkPath);
const walkDir = dirname(walkFile);
const repo = resolve(opt("--repo", process.cwd()));
const out = resolve(opt("--out", join(walkDir, basename(walkFile).replace(/\.js$/, "") + ".html")));

const errors = [], warnings = [];
const err = m => errors.push(m), warn = m => warnings.push(m);

const walkSrc = readFileSync(walkFile, "utf8");
if (/<\/script/i.test(walkSrc)) err("walk.js contains a literal </script; write it as <\\/script");
let W;
try { W = vm.runInNewContext(walkSrc + "\n;WALK", {}, { filename: walkFile }); }
catch (e) {
  const at = (String(e.stack).match(new RegExp(walkFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":(\\d+)")) || [])[1];
  console.error(`walk.js does not evaluate${at ? ` (line ${at})` : ""}: ${e.message}` +
    (/is not defined/.test(e.message) ? "\n  a ${...} inside a backtick body is evaluated; write \\${ for a literal one" : ""));
  process.exit(1);
}

for (const k of ["title", "thesis", "sources", "tracks", "map"]) if (!W[k]) err(`WALK.${k} is missing`);
if (errors.length) { errors.forEach(e => console.error("error: " + e)); process.exit(1); }

// ---------- sources ----------
const git = (...a) => execFileSync("git", ["-C", repo, ...a], { encoding: "utf8", maxBuffer: 64 << 20 });
const pinned = W.sha && W.sha !== "WORKTREE";
if (pinned) {
  try { W.sha = git("rev-parse", "--verify", `${W.sha}^{commit}`).trim(); }
  catch { err(`sha ${W.sha} is not a commit in ${repo} (fetch it, or pass --repo)`); }
} else warn("WALK.sha is not set: sources are read from the working tree and links are not pinned");

const sources = {};
for (const [key, s] of Object.entries(W.sources)) {
  let text;
  try { text = pinned && !s.file ? git("show", `${W.sha}:${s.path}`) : readFileSync(resolve(repo, s.file || s.path), "utf8"); }
  catch { err(`source "${key}": cannot read ${s.path}${pinned ? " at " + W.sha.slice(0, 10) : ""}`); continue; }
  const lines = text.replace(/\n$/, "").split("\n");
  const [a, b] = s.lines || [1, lines.length];
  if (a < 1 || b > lines.length || a > b) { err(`source "${key}": lines ${a}-${b} outside 1-${lines.length} of ${s.path}`); continue; }
  sources[key] = { path: s.path, start: a, end: b, text: lines.slice(a - 1, b).join("\n"), lang: s.lang, unpinned: !pinned || !!s.file };
  if (s.file) warn(`source "${key}" read from disk (${s.file}): not pinned`);
}

// ---------- map ----------
let svgText = "";
const mapSvg = W.map.svg && resolve(walkDir, W.map.svg);
if (!mapSvg || !existsSync(mapSvg)) err(`map.svg not found: ${W.map.svg}`);
else {
  svgText = readFileSync(mapSvg, "utf8").replace(/<\?xml[^>]*>\s*/, "");
  if (!/^\s*<svg[\s>]/.test(svgText)) err("map.svg must start with <svg");
  if (!/viewBox=/.test(svgText)) err("map.svg needs a viewBox");
}
const svgIds = new Set([...svgText.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const zones = W.map.zones || {};
const actors = new Set((W.map.actors || []).map(a => a.id));
const vb = (svgText.match(/viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/) || []).slice(1).map(Number);
const inView = ([x, y]) => vb.length < 4 || (x >= vb[0] && y >= vb[1] && x <= vb[0] + vb[2] && y <= vb[1] + vb[3]);
for (const [z, xy] of Object.entries(zones)) {
  if (!Array.isArray(xy) || xy.length !== 2) err(`zone "${z}" must be [x, y]`);
  else if (!inView(xy)) err(`zone "${z}" [${xy}] is outside the map's viewBox ${vb.join(" ")}`);
}

// ---------- scenes ----------
const TAGS = new Set(["fact", "infer", "measure", "draft", "schematic"]);
const factList = [];
let sceneCount = 0;
W.tracks.forEach((tr, t) => {
  if (!tr.name) err(`track ${t + 1} has no name`);
  if (!tr.scenes || !tr.scenes.length) { err(`track ${t + 1} has no scenes`); return; }
  if (tr.scenes.length > 14) warn(`track ${t + 1} has ${tr.scenes.length} scenes; split it`);
  tr.scenes.forEach((sc, s) => {
    sceneCount++;
    const id = `${t + 1}.${s + 1}`;
    if (!sc.t) err(`${id}: no title (t)`);
    if (!sc.body) err(`${id}: no body`);
    if (!sc.tags || !sc.tags.length) err(`${id}: no evidence tag`);
    (sc.tags || []).forEach(k => TAGS.has(k) || err(`${id}: unknown tag "${k}"`));
    if (!sc.code) err(`${id}: no code range; every scene points at the lines it explains`);
    else {
      const src = sources[sc.code.f];
      if (!W.sources[sc.code.f]) err(`${id}: unknown source "${sc.code.f}"`);
      else if (src) {
        if (!Array.isArray(sc.code.r) || !sc.code.r.length) err(`${id}: code.r must be [[a, b], ...]`);
        else sc.code.r.forEach(([a, b]) => {
          if (!(a <= b && a >= src.start && b <= src.end)) err(`${id}: range ${a}-${b} outside ${src.path} ${src.start}-${src.end}`);
        });
        if ((sc.tags || []).includes("fact")) factList.push(`${id}  ${sc.t}\n      ${src.path}:${sc.code.r.map(([a, b]) => a === b ? a : `${a}-${b}`).join(",")}`);
      }
    }
    (sc.frames || []).forEach((f, k) => {
      for (const [a, z] of Object.entries(f.at || {})) {
        if (!actors.has(a)) err(`${id} frame ${k + 1}: unknown actor "${a}"`);
        const ok = z === "hidden" || Array.isArray(z) || zones[z] || (typeof z === "string" && z[0] === "@" && actors.has(z.slice(1)));
        if (!ok) err(`${id} frame ${k + 1}: actor ${a} -> unknown zone "${z}"`);
      }
      for (const key of ["focus", "warn"]) (f[key] || []).forEach(x => svgIds.has(x) || err(`${id} frame ${k + 1}: ${key} id "${x}" not in map.svg`));
      (f.glow || []).forEach(x => actors.has(x) || err(`${id} frame ${k + 1}: glow "${x}" is not an actor`));
    });
    const words = (sc.body || "").replace(/<[^>]+>/g, "").length;
    if (words > 1100) warn(`${id}: body is ${words} chars; one idea per scene`);
  });
});
(W.concepts || []).forEach((c, i) => {
  if (c.goto && !(W.tracks[c.goto[0]] && W.tracks[c.goto[0]].scenes[c.goto[1]])) err(`concept ${i + 1} "${c.h}": goto ${c.goto} is not a scene`);
});

if (errors.length) {
  errors.forEach(e => console.error("error: " + e));
  warnings.forEach(w => console.error("warning: " + w));
  console.error(`\n${errors.length} error(s); nothing written.`);
  process.exit(1);
}

// ---------- assemble ----------
const json = JSON.stringify(sources).replace(/<\//g, "<\\/");
const template = readFileSync(join(here, "..", "assets", "player.html"), "utf8");
const escAttr = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const html = template
  .replace("@@LANG@@", () => escAttr(W.lang || (W.ui === "zh-TW" ? "zh-Hant-TW" : "en")))
  .replace("@@TITLE@@", () => escAttr(W.title))
  .replace("@@MAP@@", () => svgText)
  .replace("@@WALK@@", () => `${walkSrc}\n;WALK.sha = ${JSON.stringify(W.sha || "")};\nWALK.sources = ${json};`);
writeFileSync(out, html);

warnings.forEach(w => console.error("warning: " + w));
const kb = Math.round(Buffer.byteLength(html) / 1024);
if (kb > 1024) console.error(`warning: page is ${kb} KB; trim sources to the line ranges the scenes use`);
console.log(`wrote ${out} (${kb} KB): ${W.tracks.length} tracks, ${sceneCount} scenes, ${Object.keys(sources).length} sources${pinned ? " at " + W.sha.slice(0, 10) : ""}`);
console.log(`\nfact-check list: re-read each range and confirm the scene says only what those lines show (${factList.length}):`);
factList.forEach(l => console.log("  " + l));
