---
name: code-walkthrough
description: Walkthrough page that follows one concrete request, value or job through real code pinned at a commit, step by step beside an animated map, to give the background, context and motivation of a task. Use before implementing a GitHub issue, PR, bug fix or feature the user wants to understand first, or when they ask to be walked through how something flows through a codebase.
---

# Code walkthrough

A walkthrough is an interactive page that answers one question about a codebase: why does this task exist, and where in the code does it land? It follows one **traveler** (a request, a token, a batch, a message) through real code **pinned** at a commit. On the left, the source with the lines each step explains highlighted; on the right, a map the traveler moves across and a narration that carries one idea per step; below, the concepts, the design options and the road to done.

The reader is about to change this code. They should leave knowing the path, the mechanism behind the task, which claims are verified and which are not, and their next move.

## Evidence tags

Every scene carries at least one tag, and the reader trusts the page only as far as the tags are honest:

- `fact`: you read the cited lines at the pinned commit and they show what the scene says.
- `infer`: follows from facts by reasoning but no line shows it (allocator behavior, a performance effect, what a library does inside).
- `measure`: needs a number or an experiment before anyone relies on it. Say what would measure it.
- `draft`: a design that is not decided.
- `schematic`: the map simplifies something (one permit drawn where there are twelve). Say what it simplifies.

A scene that mixes tags says in its body which sentence carries which. When unsure between `fact` and `infer`, it is `infer`.

## Steps

Work in a directory outside the user's repository (the scratchpad if there is one), e.g. `walk-<slug>/` holding `walk.js` and `map.svg`. `<skill>` below is this skill's base directory.

1. **Frame.** Read the task's source in full: the issue with every comment, the PRs and issues it links, the discussion it came from. A PR, bug report, design doc or plain question works the same way; for a question, the answer is the thesis. Pin the commit: the tip of the default branch after a fetch, unless the task names one. Then write two sentences: the **thesis**, naming the mechanism that makes the task necessary (an ordering, a missing bound, an extra copy, a lost signal), and what done looks like for the user's task.
   Done when the thesis names a mechanism you could point at in code, not a topic.

2. **Trace.** Choose the traveler: the smallest concrete thing whose path crosses the place the task changes. Follow it from its entry point to that place, hop by hop, and keep a trace list of `path:lines — what happens — tag`. Read the existing tests that guard the path, and note what they cannot see. Read the code at the pinned commit (`git show <sha>:<path>`), not the working tree.
   Done when every hop from entry to the change site is a line range you read, and nothing in the thesis rests on a line you did not read.

3. **Script.** Turn the trace into tracks and scenes, following [writing.md](references/writing.md): the happy path end to end; the task's scenario, where the thesis happens on the map; then, when they earn it, what the tests pin down and a preview of design options.
   Done when each scene has one idea, one code range and its tags.

4. **Map.** Draw `map.svg` and declare its zones and actors, following [map-design.md](references/map-design.md).
   Done when every component the traveler crosses is a region with an id, and every mark on the map has a legend entry.

5. **Back matter.** Add concept cards, the design options table, the measurement plan, the claim status when others may be on the same task (who commented that they are taking it, which open PRs touch these files), the roadmap whose first item, done, is this page, and an out-of-scope footnote. [writing.md](references/writing.md) covers each.

6. **Build and check.** Write `walk.js` to [walk-format.md](references/walk-format.md), then run:

   ```bash
   node <skill>/scripts/build.mjs walk.js --repo <checkout of the repo>
   ```

   It pulls each source from git at the pinned commit, rejects ranges, zones and ids that do not exist, and prints the **fact-check list**: every `fact` scene with the lines it cites. Re-open each range and confirm the scene claims only what those lines show; retag or rewrite every scene that claims more.
   Done when the build passes and every entry on the fact-check list is confirmed.

7. **Deliver.** Publish the built HTML as an artifact when an artifact tool is available; otherwise give the user the file path to open in a browser. Reply with the thesis, the link, and the roadmap's next step. Keep `walk.js` and `map.svg`: rebuilding against a newer commit is how the page follows the code.

## Language

Write the page in the user's language. `ui: "zh-TW"` or `ui: "en"` picks the player's built-in labels; `uiOverrides` replaces any of them for another language.
