# walk.js format

`walk.js` declares one object, `const WALK = { ... }`. The build evaluates it, fills in the sources from git, and inlines it into the player. Keep it data plus the optional `wire` and `onFrame` functions; nothing else runs at load. A complete example: [`examples/sglang-decompression-queue/walk.js`](https://github.com/LiyangTseng/code-walkthrough/blob/main/examples/sglang-decompression-queue/walk.js).

Required: `title`, `thesis`, `sources`, `map`, `tracks`. Everything else is optional; leave out what the walkthrough does not use.

Write `body`, `concept` and section HTML as backtick template literals, and write a literal `${` inside them as `\${`: the build evaluates the file, so `${id}` in prose fails with "id is not defined".

```js
const WALK = {
  id: "repo-issue-123",              // localStorage key for the reader's position
  title: "Decompression queue memory", // 2–5 words, also the <title>
  ui: "en",                          // "en" | "zh-TW": the player's labels
  uiOverrides: {},                   // optional: replace any label (see UI_PRESETS in assets/player.html)
  eyebrow: "owner/repo #123 · area",
  thesis: "One sentence; <b>bold</b> the mechanism.",
  repoUrl: "https://github.com/owner/repo",
  sha: "full or short commit",       // the pin; the build resolves it to the full SHA
  links: [{ label: "issue #123", href: "https://..." }],
  sources: { /* below */ },
  map: { /* map-design.md */ },
  tracks: [ /* below */ ],
  concepts: [], sections: [], roadmap: [], footnote: "",   // back matter, below
};
```

Take `repoUrl` from `git remote get-url origin` (as an `https://` URL). With no remote, leave it out: the page then shows no GitHub links. `blobUrl(path, a, b)` may replace `repoUrl` for a host whose links are not GitHub-shaped. With no `sha`, sources come from the working tree and the page shows them as unpinned; use that only for uncommitted code.

## sources

```js
sources: {
  rd:  { path: "src/http/request_decompression.rs" },            // whole file
  app: { path: "src/http/app.rs", lines: [176, 221] },            // a slice
  gen: { path: "build/gen.py", file: "build/gen.py", lang: "python" }, // read from disk, unpinned
}
```

Keys are short names scenes refer to. Line numbers on the page are the file's real numbers. Slice large files to the part the scenes use: the build warns past 1 MB. `lang` is inferred from the extension (rust, python, js/ts, go, c/cpp/cuda, java/kotlin); set it when the extension says nothing.

## tracks and scenes

```js
tracks: [
  { name: "One request end to end", scenes: [
    { t: "to_bytes reads the whole body into the heap",
      code: { f: "rd", r: [[89, 94], [36, 43]] },   // source key, highlighted ranges
      tags: ["fact"],                                // evidence tags, SKILL.md
      frames: [ {...}, {...} ],                      // map states, map-design.md
      carry: false,                                  // true: start from the previous scene's final state
      body: `<p>...</p>`,                            // HTML: p, ol, ul, pre, code, strong
      concept: `<span class="ct">Bytes</span>...`,  // optional concept box
      wire(root) { /* optional: wire inputs in body */ } },
  ] },
],
```

- The GitHub link above the code spans the first range's start to the last range's end, so list the main range first.
- `wire(root)` runs each time the scene opens, with the narration element; use it for a calculator (`<div class="calc">` with labelled inputs and a `<div class="calc-out">`).
- Readers can link a scene as `page.html#2.3` (track 2, scene 3).

## Back matter

```js
concepts: [{ h: "OwnedSemaphorePermit", p: "One or two sentences.", goto: [0, 4] }],   // goto: [track, scene], 0-based
sections: [{ title: "Design options (draft)", intro: "Green is better than today; red is a new cost.", html: `...` }],
roadmap: [{ title: "Understand the path", text: "this page.", status: "done" },   // done | next | todo
          { title: "Measure before", text: "...", status: "next" }],
footnote: "Out of scope: ...",
```

Section HTML can use the player's classes: `tbl-wrap` around a `table`; `g` and `b` spans for better and worse; `cards` holding `panel card` divs; and `<button class="goto" data-go="1,2">` to jump to a scene (0-based track, scene).
