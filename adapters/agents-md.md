<!-- bubble-tracks:start -->
## bubble-tracks (fog-of-war planning)

This repo plans work as linear tracks of task bubbles in `.bubble-tracks/` (one `.json` per track; `.bubble-tracks/current` names the active one).
Manage it only through the CLI, never by hand-editing the JSON:

    node "{{CLI}}" show | switch <name> | tracks | fork [N] <name> | diverge [N] <name> | init <title>
                   | add <title> | add ? <why> | insert at N <title|? <why>> | remove N[:M]
                   | move N[:M] to M | rename N <title> | title <text> | hint N <text> | fog [N[:M]] [TYPE]
                   | why [N] <text> | type [N] <TYPE> | answer [N] <text> | fill [N] <title> | done | research [N] [focus]
                   | finding N <text> | abilities | bubble:<name> [text]

Full instructions: `{{SKILL}}`.

Rules:
- If `node` is missing (exit 127, `command not found`), read `fallback.md` next to `{{SKILL}}` and edit the track by hand as it describes, gate included.
- Before editing project files, run `node "{{CLI}}" show`. If it exits 3, the active bubble is fog, so do not edit.
- At fog, never plan it yourself. Ask the human to classify it (known-known, known-unknown, unknown-known, unknown-unknown) and wait for their content before running `fill`.
- When the active bubble is a known task, read its hint, implement it, then run `done`.
- Keep each track to one domain. If the human asks for something that doesn't belong to the active bubble, don't `add` it: run `fork <name>` if it builds on the bubble (the bubble waits for it), or `diverge <name>` if it goes a different direction (nothing waits). Ask the human first (suggest one: fork / diverge / keep here), run it only after they pick, then treat the new track as fresh: ask, sketch, classify all fog.
- `bubble switch <name>` resumes a track (read all bubbles and hints, then continue at the active one) or creates it. Apply it right away without asking why. If you see a better name (e.g. `single commit` -> `single-commit`), use it and say so in one line.
- Every fog gets one line on why it's unclear (`add ? <why>` or `why N <text>`), never what it is.
- After sketching a track, always list every fog bubble by number and ask the human to answer each one as `N: <their content>` (then `fill`) or `N:kk|ku|uk|uu` (then `type`), or `N:?` when they don't know enough yet (run `research N`, show the findings, then ask again; it stays fog). If their words don't settle it yet, it stays fog: keep them verbatim with `answer N <their words>`, and build on them with the human (fill, hint, guard, new bubbles or a fork).
- When the human asks to research a bubble (`research [N] [focus]`), run it and follow the printed workflow once: extend their intent, never overrule it; stay on that bubble; bring back at least 2–3 guides or tips with sources (subagents with the printed context, if you have them), note each with `finding N <tip — source>`, propose inserts or a fork/diverge without applying them, never fill fog, then stop.
- When the chat gets long, save `handoff <note>` (what's half done, the decisions made, the next step) and suggest a fresh chat with `bubble switch <name>`.
- After `done`, stop (⏸): show the track and wait for the human before starting the next bubble.
- When the human writes `bubble <command>`, run exactly that command through the CLI and show the result.
- After every change, show the user the rendered track line.
- When the human writes `bubble:<name> [text]` (or `/bubble:<name>`), run that through the CLI and follow the printed workflow once against the printed context (the active bubble or the whole track), then report back and stop. Never apply an ability on your own.
<!-- bubble-tracks:end -->
