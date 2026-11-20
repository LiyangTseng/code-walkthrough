# Map design

The map is the picture the reader keeps after the page is closed. It shows where the traveler is and what it is holding at each step, so the thesis becomes something they can see: queued bodies piling up in the heap, a request crossing a second listener, a value copied twice.

## What goes on it

- **Regions are the components the code names**: layers, queues, pools, threads, processes, memory, the network. Lay them out in the order the traveler crosses them, left to right or top to bottom. A region the traveler never touches does not belong.
- **Actors are the things that move**: the traveler (one or several instances, A, B, C), the data it carries (body chunks, KV blocks), and the tokens that gate it (a permit, a lock, a slot).
- **State that accumulates gets its own region**, with one lane per traveler instance, so the thesis moment (memory held while waiting, work duplicated) is visible as marks piling up.
- Draw what the code has. Where the map simplifies (one permit for N, four chunks for a body), the scene says so and carries the `schematic` tag.

## map.svg

A static SVG with a `viewBox` (600–820 wide fits the panel) holding the regions and labels. The player adds the actors on top. Classes the player styles in both themes:

| Class | For |
|---|---|
| `box` on a `rect` | a region; give it an `id` to focus or warn it |
| `layer` on a `g` holding a `rect` and a `text` | a step in a chain (middleware, pipeline stage); `id` on the `g` |
| `lbl`, `lbl-strong` | small muted label, region title |
| `arrow`, `lane` | solid connector, dashed path |

Text no smaller than 11px in viewBox units. No colors in the SVG itself: the classes carry them, so dark mode works.

## WALK.map

```js
map: {
  svg: "map.svg",
  note: [196, 410],                   // where the per-frame note text goes (optional)
  zones: { clientA: [30, 110], L2: [456, 50], acquire: [215, 150], heapA: [222, 266] },
  actors: [
    { id: "A", label: "A" },                                   // token: a labelled circle (default)
    { id: "bodyA", kind: "chip", count: 4, tone: "warm" },     // a row of squares, left edge at the zone
    { id: "permit", kind: "diamond", tone: "accent" },
  ],
  legend: [{ mark: "token", tone: "ink", text: "A / B / C: one request" }],
  frameMs: 850,                       // pause between frames (optional)
  onFrame(state, svg, { el }) {},     // optional: draw what the actors cannot (below)
}
```

- **Tones:** `ink`, `muted`, `accent`, `warm`, `cool`, `good`, `bad`. Keep one meaning per tone across the page.
- **Legend marks:** `token`, `chip`, `diamond`, `outline` (a warned region), `dash`, `line`. Every mark on the map gets an entry.

## Frames

Each scene plays its `frames` in order. A scene starts with every actor hidden (or, with `carry: true`, from the previous scene's last frame); each frame merges into the state so far.

```js
frames: [
  { at: { A: "L2", bodyA: "sockA", permit: "acquire" }, focus: ["L2"] },
  { at: { bodyA: "heapA" }, focus: ["heap"], note: "A's body is now in the heap" },
  { at: { A: "acquire", permit: "@A" }, warn: ["heap"], glow: ["bodyA"],
    meters: [{ k: "queued bytes", v: "128 MiB", tone: "bad" }] },
]
```

| Field | Merge | Meaning |
|---|---|---|
| `at` | per actor | a zone name, `[x, y]`, `"@other"` (ride beside another actor, as a permit rides its holder) or `"hidden"`. Tokens sharing a zone spread out side by side. |
| `focus`, `warn` | replace | ids in map.svg to highlight (accent) or flag (red). Warn the region where the thesis happens. |
| `glow` | replace | actor ids to outline: "look at this one". |
| `note` | replace | one line under the map. |
| `meters` | replace | `{ k, v, tone: "good" \| "bad" \| "key" }` chips under the map, for numbers that change. |
| `custom` | per key | free data for `onFrame`. |

Two to four frames per scene: the state before, the move, the consequence.

## onFrame

When the thesis needs a mark the actors cannot draw (a bar of `len` inside `capacity`, a counter filling), draw it in `onFrame(state, svg, { el })`, which runs after every frame. Create the elements once and update them from `state.custom`; `el(tag, attrs, parent)` makes an SVG element.
