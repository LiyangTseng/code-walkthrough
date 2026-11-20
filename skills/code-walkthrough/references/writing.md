# Writing the walkthrough

## Tracks

A track is one story the traveler lives through. Two to four tracks, four to ten scenes each:

1. **The happy path, end to end.** One traveler from the entry point to where the task's change lands. The reader builds the mental model here, before anything goes wrong.
2. **The task's scenario.** The same path under the conditions the task is about: three requests at once, the failing input, the second rank, the feature that is missing. The thesis happens on the map in this track, on a scene whose map warns the region where it happens.
3. **What the tests pin down** (when the task will change tested code). What each existing test asserts, how it drives the code, and its blind spot. The blind spot is usually the first regression test to write.
4. **Design options preview** (when the task has more than one fix). Each option as a scene tagged `draft`, showing how the map would change and what it costs.

## Scenes

- **Title is the claim of the step**, a sentence: "to_bytes reads the whole compressed body into the heap", not "to_bytes".
- **One idea per scene**, in at most three short paragraphs. A scene that needs a fourth paragraph is two scenes.
- **Cite line numbers in the prose** ("line 95 takes the permit") so the reader's eye goes to the highlighted code.
- **Bold the sentence that connects the step to the thesis**, at most once per scene.
- **Concrete numbers over adjectives**: "min(32, CPUs + 4), so 12 on 8 cores", not "a limited number".
- **The concept box teaches the one language or framework idea this scene needs**, at the moment it is needed: RAII where the permit is dropped, `let-else` where it first appears. Assume the reader knows programming but not this language, framework or codebase. Title it with the term; one to three sentences.
- When a scene mixes tags, mark the inference in the prose ("inference, not measured:").

## Back matter

- **Concept cards:** one per concept a reader would look up later, each linking (`goto`) to the scene where it is taught.
- **Design options table** (when there are options): one row per option including "today", one column per property the task cares about (memory held, latency, bytes on the wire, code it touches, risk). Green for better than today, red for a new cost. Title it as a draft.
- **Measurement plan** (when the task needs evidence): what to measure, where (unit harness, local server, real hardware the reader may lack), how before and after compare, and the test that fails today and passes after the change.
- **Claim status** (on a shared tracker): who said on the issue they are taking which part, and which open PRs touch the same files, with the date you checked.
- **Roadmap:** the first item is this page, done; the next item is concrete enough to start today; the last is the PR. Mark exactly one `next`.
- **Footnote:** what is out of scope and why, and a reminder that inferences are not measured.
