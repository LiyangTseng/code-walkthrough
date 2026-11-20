// Example walkthrough: why queued decompressions still hold their whole body in memory
// (sgl-project/sglang issue #49055, item 9). Build from an sglang checkout:
//   node ../../skills/code-walkthrough/scripts/build.mjs walk.js --repo ~/path/to/sglang
const RD = "rd", APP = "app";

const WALK = {
  id: "sglang-49055-item9",
  title: "Decompression queue memory",
  ui: "en",
  eyebrow: "sgl-project/sglang #49055 · item 9 · rust/sglang-server",
  thesis: "The semaphore caps how many bodies decompress at once, but each request reads its <b>whole compressed body into memory before it waits</b> for a permit.",
  repoUrl: "https://github.com/sgl-project/sglang",
  sha: "51401babd16ead3e5ea39f6c5a4daba050066872",
  links: [
    { label: "issue #49055", href: "https://github.com/sgl-project/sglang/issues/49055" },
    { label: "Python version, L60-74", href: "https://github.com/sgl-project/sglang/blob/51401babd16ead3e5ea39f6c5a4daba050066872/python/sglang/srt/entrypoints/http_request_decompression.py#L60-L74" },
  ],
  sources: {
    rd: { path: "rust/sglang-server/src/api_server/http/request_decompression.rs" },
    app: { path: "rust/sglang-server/src/api_server/http/app.rs", lines: [176, 221] },
  },

  map: {
    svg: "map.svg",
    note: [196, 410],
    zones: {
      clientA: [30, 110], clientB: [30, 200], clientC: [30, 290],
      sockA: [64, 110], sockB: [64, 200], sockC: [64, 290],
      heapA: [222, 266], heapB: [222, 316], heapC: [222, 366],
      L0: [232, 50], L1: [344, 50], L2: [456, 50], L3: [568, 50], L4: [680, 50],
      acquire: [215, 150], q0: [300, 150], q1: [340, 150], pool: [560, 150],
    },
    actors: [
      { id: "A", label: "A" }, { id: "B", label: "B" }, { id: "C", label: "C" },
      { id: "bodyA", kind: "chip", count: 4, tone: "warm" },
      { id: "bodyB", kind: "chip", count: 4, tone: "warm" },
      { id: "bodyC", kind: "chip", count: 4, tone: "warm" },
      { id: "permit", kind: "diamond", tone: "accent" },
    ],
    legend: [
      { mark: "token", tone: "ink", text: "A / B / C: one request (its headers)" },
      { mark: "chip", tone: "warm", text: "one chunk of a compressed body" },
      { mark: "diamond", tone: "accent", text: "decompression permit" },
    ],
  },

  tracks: [
    { name: "One request end to end", scenes: [
      { t: "The request crosses the layers outside-in", code: { f: APP, r: [[181, 181], [201, 206]] }, tags: ["fact"],
        frames: [
          { at: { A: "clientA", bodyA: "sockA", permit: "acquire" } },
          { at: { A: "L0" }, focus: ["L0"] }, { at: { A: "L1" }, focus: ["L1"] }, { at: { A: "L2" }, focus: ["L2"] },
        ],
        body: `<p>Each <code>.layer(...)</code> or <code>xxx::apply(app, ...)</code> in <code>app.rs</code> wraps <strong>everything built so far</strong>, so the later a layer is added, the further out it sits. A request passes log → auth → decompress → DP relay → handler.</p>
<p>When the request reaches a middleware, only its <strong>headers</strong> are known to be read. The four body chunks are still in the socket.</p>
<p>Line 205 says auth sits outside decompression, so an unauthenticated body is never inflated. Line 181 disables the body size limit, as the Python server does.</p>`,
        concept: `<span class="ct">Onion model</span>Tower layers nest like an onion: requests go in from the outermost layer, responses come back out. <code>app.layer(X)</code> always puts X on the outside.` },

      { t: "No x-body-compressed header: pass straight through", code: { f: RD, r: [[63, 71]] }, tags: ["fact"],
        frames: [{ at: { A: "L2", bodyA: "sockA", permit: "acquire" }, focus: ["L2"] }],
        body: `<p>Three outcomes:</p>
<ol><li>No header: <code>next.run(request)</code> hands the request inward untouched. A normal request pays one header lookup.</li>
<li>A method other than <code>zstd</code>: a plain-text 400 with Python's message.</li>
<li><code>zstd</code>: carry on to the body.</li></ol>`,
        concept: `<span class="ct">let-else</span><code>let Some(m) = ... else { return ...; };</code> binds when the pattern matches; otherwise the <code>else</code> block runs and must leave the function.` },

      { t: "Headers and body split: the body is still lazy", code: { f: RD, r: [[73, 74], [88, 88]] }, tags: ["fact"],
        frames: [{ at: { A: "L2", bodyA: "sockA", permit: "acquire" }, focus: ["L2"], glow: ["bodyA"], note: "The body stays in the socket until someone polls it" }],
        body: `<p><code>into_parts()</code> splits the <code>Request</code> into <code>Parts</code> (method, URI, headers) and a <code>Body</code>.</p>
<p><code>Body</code> is a <strong>stream</strong>: data arrives only as it is polled. Until then the bytes sit in the kernel's socket buffer, or the client has not sent them; when the buffer fills, TCP flow control pauses the client.</p>
<p>So when to read is the code's choice. Any fix for this item uses that.</p>`,
        concept: `<span class="ct">poll</span>Rust futures and streams do nothing until polled. <code>.await</code> polls until the result is <code>Ready</code>.` },

      { t: "to_bytes reads the whole compressed body into the heap", code: { f: RD, r: [[89, 94]] }, tags: ["fact"],
        frames: [
          { at: { A: "L2", bodyA: "sockA", permit: "acquire" }, focus: ["L2"] },
          { at: { bodyA: "heapA" }, focus: ["heap"], note: "A's compressed body is now in the heap" },
        ],
        body: `<p><code>axum::body::to_bytes(body, usize::MAX)</code> polls the body to its end and collects it into one <code>Bytes</code>, with no size cap.</p>
<p><strong>This is where item 9 starts:</strong> it runs <strong>before</strong> the permit is taken on line 95. From here on, the request holds its whole compressed body.</p>
<p>Lines 92-94: an empty body returns early without a permit.</p>`,
        concept: `<span class="ct">Bytes</span><code>bytes::Bytes</code> is an immutable byte buffer whose <code>clone</code> only bumps a reference count. axum and hyper pass bodies around as <code>Bytes</code>.` },

      { t: "acquire_owned takes a permit", code: { f: RD, r: [[95, 98], [36, 43]] }, tags: ["fact", "schematic"],
        frames: [
          { at: { A: "L2", bodyA: "heapA", permit: "acquire" }, focus: ["sem"] },
          { at: { A: "acquire", permit: "@A" } },
        ],
        body: `<p>The <code>Semaphore</code> holds N permits, N = <code>python_executor_workers()</code> = min(32, CPUs + 4) (lines 36-43), the worker count of Python's default executor. The map draws one.</p>
<p>A free permit is granted at once; otherwise the task <strong>sleeps in a FIFO queue</strong> and uses no CPU.</p>
<p><code>acquire_owned</code> rather than <code>acquire</code>: the owned permit holds its own <code>Arc</code> and is <code>'static</code>, so it can move into <code>spawn_blocking</code>.</p>`,
        concept: `<span class="ct">RAII</span>Nobody returns the permit by hand: dropping it returns it to the semaphore and wakes the next waiter.` },

      { t: "spawn_blocking moves the decode off the async workers", code: { f: RD, r: [[99, 105]] }, tags: ["fact"],
        frames: [
          { at: { A: "acquire", bodyA: "heapA", permit: "@A" }, focus: ["pool"] },
          { at: { A: "pool" } },
        ],
        body: `<p>zstd decoding is synchronous and CPU-bound. On an async worker it would stall every other task on that thread, so <code>spawn_blocking</code> runs it on the blocking pool. The semaphore, not the pool, limits how many run at once.</p>
<p><code>let _permit = permit;</code> moves the permit into the closure, so it is returned when the closure ends. <code>compressed</code> moves in too and is freed at the same moment.</p>`,
        concept: `<span class="ct">_permit is not _</span><code>let _permit = permit;</code> keeps the value alive to the end of scope. <code>let _ = permit;</code> drops it on that line, returning the permit at once and disabling the limit.` },

      { t: "The permit returns; the handler gets the decompressed body", code: { f: RD, r: [[81, 85], [99, 102]] }, tags: ["fact"],
        frames: [
          { at: { A: "pool", bodyA: "heapA", permit: "@A" } },
          { at: { A: "L3", bodyA: "hidden", permit: "acquire" }, focus: ["L3"], note: "Closure ends: _permit and compressed drop together" },
          { at: { A: "L4" }, focus: ["L4"], note: "The handler receives the decompressed body" },
        ],
        body: `<p>When the closure ends, <code>_permit</code> and <code>compressed</code> drop: the permit wakes the next waiter and the compressed body is freed.</p>
<p>Back on the async side the header is removed, <code>content-length</code> is set to the decompressed length, and the rebuilt request goes inward.</p>
<p>The permit is returned <strong>before</strong> the handler runs: the semaphore governs decompression only.</p>` },
    ] },

    { name: "Three requests at once", scenes: [
      { t: "A is decoding when B and C arrive", code: { f: RD, r: [[99, 102]] }, tags: ["schematic"],
        frames: [
          { at: { A: "pool", bodyA: "heapA", permit: "@A" } },
          { at: { B: "clientB", C: "clientC", bodyB: "sockB", bodyC: "sockC" } },
        ],
        body: `<p>The map has one permit. A holds it and is decoding on the blocking pool.</p>
<p>B's and C's headers arrive; their bodies are still in their sockets.</p>`,
        concept: `<span class="ct">On a real server</span>There are min(32, CPUs + 4) permits, so queueing starts only past that many concurrent requests, and the queue itself has no bound.` },

      { t: "B and C go straight into to_bytes", code: { f: RD, r: [[89, 91]] }, tags: ["fact"], carry: true,
        frames: [
          { at: { B: "L2", C: "L2" }, focus: ["L2"] },
          { at: { bodyB: "heapB", bodyC: "heapC" }, focus: ["heap"], note: "B's and C's bodies are read while A still holds the permit" },
        ],
        body: `<p>The first thing <code>decompress_zstd</code> does is read the body, and that step ignores the permit. B's and C's compressed bodies land in the heap whether or not a permit is free.</p>`,
        concept: `<span class="ct">Concurrency</span>Each connection is its own tokio task, so B's and C's <code>to_bytes</code> run while A decodes.` },

      { t: "B and C queue: CPU is capped, memory is not", code: { f: RD, r: [[95, 98]] }, tags: ["fact", "measure"], carry: true,
        frames: [
          { at: { B: "q0", C: "q1" }, focus: ["sem"] },
          { glow: ["bodyB", "bodyC"], focus: ["sem", "heap"], warn: ["heap"], note: "Still queued, still holding their bodies" },
        ],
        body: `<p>B and C sleep in <code>acquire_owned().await</code> and use no CPU, but their <code>compressed</code> buffers are already in the heap and stay there until each finishes decoding.</p>
<p><strong>This is item 9:</strong> concurrent decodes are capped at P, the memory of queued bodies is not.</p>
<p>The order of the code is verified. That the queued bodies are fully read still needs a measurement: a body stream that records each poll.</p>`,
        concept: `<span class="ct">Admission control</span>Deciding when a request may start consuming a resource. Here admission happens after the memory is already spent.` },

      { t: "Scale it to N requests", code: { f: RD, r: [[36, 43], [89, 98]] }, tags: ["infer", "measure"],
        frames: [{ at: { A: "L4", B: "pool", C: "q0", bodyB: "heapB", bodyC: "heapC", permit: "@B" }, glow: ["bodyC"], focus: ["heap"], note: "queued bytes ≈ (N − P) × S" }],
        body: `<p>N concurrent requests, S MiB compressed each, P permits: up to about (N − P) × S of compressed bodies wait in the heap.</p>
<div class="calc">
  <label>Concurrent requests N<input id="calc-n" type="number" min="1" value="200"></label>
  <label>Compressed size S (MiB)<input id="calc-s" type="number" min="0" value="64"></label>
  <label>Permits P<input id="calc-p" type="number" min="1" max="32" value="12"></label>
</div>
<div class="calc-out" id="calc-out"></div>
<p>An arithmetic bound, not a measurement.</p>`,
        wire(root) {
          const n = root.querySelector("#calc-n"), s = root.querySelector("#calc-s"), p = root.querySelector("#calc-p"), out = root.querySelector("#calc-out");
          const fmt = mib => mib >= 1024 ? `${(mib / 1024).toFixed(1)} GiB` : `${Math.round(mib)} MiB`;
          const upd = () => { const q = Math.max(0, (+n.value || 0) - Math.max(1, +p.value || 1)); out.innerHTML = `${q} requests queued, holding about <b>${fmt(q * (+s.value || 0))}</b>`; };
          [n, s, p].forEach(x => x.addEventListener("input", upd)); upd();
        } },

      { t: "Preview, option A: take the permit before reading the body", code: { f: RD, r: [[89, 98]] }, tags: ["draft"],
        frames: [
          { at: { A: "pool", bodyA: "heapA", permit: "@A", B: "L2", C: "L2", bodyB: "sockB", bodyC: "sockC" } },
          { at: { B: "q0", C: "q1" }, focus: ["sem"], glow: ["bodyB", "bodyC"], note: "Option A: queued bodies stay in the socket" },
        ],
        body: `<p>Move lines 95-98 above line 89, and a queued request holds only its headers; its body waits in the socket and TCP pauses the client.</p>
<p>The cost: the body is read after the permit is granted, so a slow uploader holds a permit and blocks the queue behind it.</p>`,
        concept: `<span class="ct">Slowloris</span>An attack that sends data slowly to keep server resources tied up. Option A lets a slow client pin a permit.` },
    ] },
  ],

  concepts: [
    { h: "Body (lazy stream)", p: "Only headers are known to be read; the body leaves the socket as it is polled.", goto: [0, 2] },
    { h: "to_bytes", p: "Polls to the end and collects one Bytes. Item 9 is that it runs before the permit.", goto: [0, 3] },
    { h: "OwnedSemaphorePermit", p: "Holds an Arc, so it is 'static and can move to another thread; dropping it returns the permit.", goto: [0, 4] },
    { h: "spawn_blocking", p: "Runs sync, CPU-bound work off the async workers. let _permit keeps the permit; let _ drops it.", goto: [0, 5] },
  ],

  sections: [
    { title: "Design options (draft, not decided)", intro: "Green is better than today; red is a new cost.",
      html: `<div class="tbl-wrap"><table>
<thead><tr><th>Option</th><th>Memory while queued</th><th>New cost</th></tr></thead>
<tbody>
<tr><td><b>Today</b></td><td>Whole compressed body per queued request</td><td>None</td></tr>
<tr><td><b>A: permit first</b></td><td><span class="g">Headers only</span></td><td><span class="b">A slow uploader holds a permit</span></td></tr>
<tr><td><b>B: admit by bytes</b></td><td><span class="g">Bounded by a byte budget</span></td><td><span class="b">No Content-Length, bodies over the budget, acquire_many takes u32</span></td></tr>
</tbody></table></div>` },
  ],

  roadmap: [
    { title: "Understand the path", text: "this page.", status: "done" },
    { title: "Build and test locally", text: "cargo test, clippy, fmt.", status: "next" },
    { title: "Measure before", text: "a counting GlobalAlloc, and a body stream that records polls.", status: "todo" },
    { title: "Choose a design", text: "A, B, or a mix, with the maintainers on the issue.", status: "todo" },
    { title: "Implement, add a regression test, measure after", status: "todo" },
  ],
  footnote: "Out of scope: the DP relay buffering the whole body again (item 2). Every inference on this page is tagged as such and not yet measured.",
};
