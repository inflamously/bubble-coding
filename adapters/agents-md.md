<!-- bubble-coding:start -->
## Bubble Planner (fog-of-war planning)

This repo plans work as linear tracks of task bubbles in `.bubbles/` (one `.json` per track; `.bubbles/current` names the active one).
Manage it only through the CLI, never by hand-editing the JSON:

    node "{{CLI}}" show | switch <name> | tracks | fork [N] <name> | diverge [N] <name> | init <title>
                   | add <title> | add ? | insert at N <title|?> | remove N[:M]
                   | move N[:M] to M | rename N <title> | title <text> | hint N <text> | fog [N[:M]] [TYPE]
                   | type [N] <TYPE> | fill [N] <title> | done

Full instructions: `{{SKILL}}`.

Rules:
- Before editing project files, run `node "{{CLI}}" show`. If it exits 3, the active bubble is fog, so do not edit.
- At fog, never plan it yourself. Ask the human to classify it (known-known, known-unknown, unknown-known, unknown-unknown) and wait for their content before running `fill`.
- When the active bubble is a known task, read its hint, implement it, then run `done`.
- Keep each track to one domain. If the human asks for something that doesn't belong to the active bubble, don't `add` it: run `fork <name>` if it builds on the bubble (the bubble waits for it), or `diverge <name>` if it goes a different direction (nothing waits). Ask the human first (suggest one: fork / diverge / keep here), run it only after they pick, then treat the new track as fresh: ask, sketch, classify all fog.
- `bubble switch <name>` resumes a track (read all bubbles and hints, then continue at the active one) or creates it. Apply it right away without asking why. If you see a better name (e.g. `single commit` -> `single-commit`), use it and say so in one line.
- After sketching a track, always list every fog bubble by number and ask the human to answer each one as `N: <their content>` (then `fill`) or `N:kk|ku|uk|uu` (then `type`).
- When the chat gets long, save `handoff <note>` (what's half done, the decisions made, the next step) and suggest a fresh chat with `bubble switch <name>`.
- After `done`, stop (⏸): show the track and wait for the human before starting the next bubble.
- When the human writes `bubble <command>`, run exactly that command through the CLI and show the result.
- After every change, show the user the rendered track line.
<!-- bubble-coding:end -->
