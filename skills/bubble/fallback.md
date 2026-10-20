# bubble-tracks without Node

Read this only when the CLI can't run because `node` is missing (exit 127, `command not found`). Everything in SKILL.md still applies: sketch, classify fog, walk, ⏸ stop after every bubble, hand off. The only change is that you edit the track files yourself. This is the one case where hand-editing `.bubble-tracks/` is allowed.

Tell the human once: *"Node isn't available here, so I'm editing the track by hand. Fork, diverge, close, delete and move --to need Node."*

## The fog gate is on you

Without Node, no hook blocks your edits. Before editing any project file, read the current track. If its active bubble is fog, **don't edit**. Go to SKILL.md step 3 and ask the human. Edits under `.bubble-tracks/` are always allowed.

## Where tracks live

- `.bubble-tracks/` sits at the repo root. Look for it in the working directory, then in each parent.
- Each track is `.bubble-tracks/<name>.json`. Names use only letters, digits, `-` and `_`.
- `.bubble-tracks/current` holds the current track's name plus a newline. With no `current` file, the current track is `track` (`track.json`).

## A track file

```json
{
  "title": "Fix generation",
  "bubbles": [
    { "title": "Repro", "state": "done", "id": 1 },
    { "title": "???", "state": "fog", "id": 2, "type": "unknown-known" },
    { "title": "Patch", "state": "todo", "id": 3, "hint": "only touch gen.py" }
  ],
  "nextId": 4,
  "handoff": { "note": "Repro is in test_gen.py. Next: ask the human about bubble 2.", "at": "2026-10-20 18:10 UTC" }
}
```

Track fields:

- `title`: the track's name, kept short.
- `bubbles`: the bubbles in order, S to F. Required, even when empty (`[]`).
- `nextId`: the id the next new bubble gets. Missing means 1.
- `handoff`: `{ "note", "at" }`, where `at` is UTC as `YYYY-MM-DD HH:MM UTC`.
- `parent`, `origin`, `closed`: set by fork, diverge and close. Never add or change them by hand.

Bubble fields:

- `title`: 2–4 words; fog bubbles have `???` until filled.
- `state`: `todo`, `fog` or `done`. Never store `active`: the **active bubble is the first one that isn't `done`**.
- `id`: stable and never reused. Take it from `nextId`, then add 1 to `nextId`.
- `type`: the fog classification: `known-known`, `known-unknown`, `unknown-known` or `unknown-unknown`.
- `hint`: the human's note for this bubble.
- `fork`, `sides`: links to other tracks. Leave them as they are.

Keep valid JSON with 2-space indentation and a final newline. Change only the fields a command touches, and leave unknown fields alone.

## Doing the commands by hand

N is a 1-based position on the track. When N is left out, it means the active bubble.

| Command | Edit |
|---|---|
| `show` | Read the file and draw the line: `<title>   S ●──◐──○ F   prev ‹ ◐ active › next`. `●` is done, `◐` is the active bubble, `○` is todo and `❓` is fog. If the active bubble is fog, its label is `❓ needs you`. Then list the bubbles by number with their hints. An active fog bubble is the gate (step 3). |
| `switch <name>` | If `<name>.json` exists, write `<name>` to `current` and resume it. Otherwise create it (below). |
| `create <name> [title]` · `init <title>` | Write `{ "title": "<title or name>", "bubbles": [] }` to `<name>.json`, then write `<name>` to `current`. `init` creates `track`. |
| `add <title>` · `add ?` | Append `{ "title", "state": "todo", "id" }`, or `{ "title": "???", "state": "fog", "id" }` for fog. Take the id from `nextId`. |
| `insert at N …` | Like `add`, but put the bubble at position N. |
| `fill [N] <title>` | Only for a fog bubble: set `title`, and set `state` to `todo`. |
| `type [N] <TYPE>` | Set `type`. Expand `kk`, `ku`, `uk` and `uu`. |
| `hint N <text>` · `hint N -` | Set `hint`, or delete the field with `-`. |
| `handoff <note>` · `handoff -` | Set `handoff` to `{ "note", "at" }`, or delete it with `-`. |
| `done` | Set the active bubble's `state` to `done` (never a fog bubble), then ⏸ stop. If it has a `fork`, don't pop it: that bubble waits for its fork track. |
| `rename N` · `title` · `remove` · `move N to M` · `fog` | Edit `title`, delete bubbles, reorder the array, or set `state` to `fog`. Done bubbles turn into fog only after the human confirms. |
| `tracks` | List the `*.json` files and mark the current one with `→`. |

If a track has `closed`, it's read-only, so don't change it. `fork`, `diverge`, `close`, `delete` and `move … --to` keep links between tracks in sync. Leave them for when Node is available and tell the human that.
