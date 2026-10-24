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
- `goal`: the one end result every bubble serves.
- `guards`: rules of what not to do, as an array of strings. Check them before `done`.
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
- `why`: set while fog: one line on why it's unclear (not what it is).
- `answer`: set while fog: the human's own words on it, kept as they said them while it stays fog.
- Both stay after `fill`, as the trail of how the bubble was planned.
- `findings`: what research found for this bubble, as an array of strings (a guide or tip, with its source).
- `fork`, `sides`: links to other tracks. Leave them as they are.

Keep valid JSON with 2-space indentation and a final newline. Change only the fields a command touches, and leave unknown fields alone.

## Doing the commands by hand

N is a 1-based position on the track. When N is left out, it means the active bubble.

| Command | Edit |
|---|---|
| `show` | Read the file and draw the line: `<title>   S ●──◐──○ F   prev ‹ ◐ active › next`. `●` is done, `◐` is the active bubble, `○` is todo and `❓` is fog. If the active bubble is fog, its label is `❓ needs you`. Then list the bubbles by number with their hints. An active fog bubble is the gate (step 3). |
| `switch <name>` | If `<name>.json` exists, write `<name>` to `current` and resume it. Otherwise create it (below). |
| `create <name> [title]` · `init <title>` | Write `{ "title": "<title or name>", "bubbles": [] }` to `<name>.json`, then write `<name>` to `current`. `init` creates `track`. |
| `add <title>` · `add ? <why>` | Append `{ "title", "state": "todo", "id" }`, or `{ "title": "???", "state": "fog", "id", "why" }` for fog. Take the id from `nextId`. |
| `insert at N …` | Like `add`, but put the bubble at position N. |
| `fill [N] <title>` | Only for a fog bubble: set `title`, and set `state` to `todo`. |
| `type [N] <TYPE>` | Set `type`. Expand `kk`, `ku`, `uk` and `uu`. |
| `why [N] <text>` · `answer [N] <text>` | Only for a fog bubble: set `why` or `answer`, or delete the field with `-`. |
| `hint N <text>` · `hint N -` | Set `hint`, or delete the field with `-`. |
| `handoff <note>` · `handoff -` | Set `handoff` to `{ "note", "at" }`, or delete it with `-`. |
| `finding N <text>` · `finding N M -` · `finding N -` | Append to `findings`, drop finding M, or delete `findings` with `-`. Delete the field when it ends up empty. `show` lists them as `found 1:`, `found 2:`… |
| `research [N] [focus]` | Changes nothing. Follow SKILL.md's **Research** section on bubble N, with its context: the track's `goal` and `guards`, the bubble's `title`, `state`, `type`, `why`, `answer`, `hint` and `findings`, and the bubbles before and after it. Not on a closed track. |
| `goal <text>` · `goal -` | Set `goal`, or delete it with `-`. |
| `guard <text>` · `guard N -` · `guard -` · `guard show` | Append to `guards`, drop guard N, or delete `guards` with `-`. Delete the field when it ends up empty. `guard show` lists them; `show` doesn't, only `switch` does. |
| `done` | Set the active bubble's `state` to `done` (never a fog bubble), then ⏸ stop. If it has a `fork`, don't pop it: that bubble waits for its fork track. |
| `rename N` · `title` · `remove` · `move N to M` · `fog` | Edit `title`, delete bubbles, reorder the array, or set `state` to `fog`. Done bubbles turn into fog only after the human confirms. |
| `tracks` · `--closed` · `--all` | List the `*.json` files and mark the current one with `→`. Skip tracks that have `closed` (unless current) and say how many you skipped; `--closed` lists only those, `--all` lists everything. |

If a track has `closed`, it's read-only, so don't change it. `fork`, `diverge`, `close`, `delete` and `move … --to` keep links between tracks in sync. Leave them for when Node is available and tell the human that.

## Abilities by hand

An ability is a workflow the human applies with `bubble:<name>` (or `/bubble:<name>`). Reading them needs no Node:

- **Where:** `<name>.md` in `.bubble-tracks/abilities/` (project) and `~/.bubble-tracks/abilities/` (user). When both have the same name, the project one wins.
- **The file:** a `---` frontmatter block with `name` (default: the filename without `.md`), `description` (one line) and `type` (`bubble` or `track`), then the body: the workflow. A file is broken if it has no frontmatter, a `type` that isn't one of those two, a name with characters other than letters, digits, `-` and `_`, or an empty body.
- **`abilities`:** list every ability by name with its type, `project` or `user`, and its description. Mark broken ones `broken`, with the reason.
- **`bubble:<name> [text]`:** read the file and run its body **once**. Any words after the name are the human's extra steer. The context is the active bubble (number, title, state, type, hint) for `type: bubble`, or the whole track, as `show` gives it, for `type: track`. A `type: bubble` ability needs an active bubble. If the track is all done or closed, say so and don't run it. Afterwards, report back to the human. Change the track only with the edits above, and never fill fog yourself. Nothing stays attached: the ability runs again only when the human invokes it.
