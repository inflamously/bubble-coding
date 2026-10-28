# bubble-tracks

**Gamified planning for coding agents, with fog of war.**

A plan is a single track of task bubbles. The agent works the bubbles it can see, and stops at the fog so you can plan what comes next.

```
Fix generation   S ●──●──❓──○ F   Read logs ‹ ❓ needs you › Write failing test
```

`●` done · `◐` active · `○` todo · `❓` fog (unplanned) · `prev ‹ active › next` shows where you are

▶ **[Live demo](https://inflamously.github.io/bubble-tracks/)**: the real CLI playing a full session in an emulated terminal.

## How it works

- **Plan only as far as you can see.** Unclear steps stay fog until you reach them.
- **Known bubbles** are implemented by the agent.
- **Fog bubbles** stop the agent. You plan them, and the agent never plans fog on its own.
- **You steer between bubbles.** After every bubble the agent pauses (⏸), so you can reorder, insert, remove or fog bubbles before it goes on.
- **One line, as long as it needs.** If a fog bubble turns out to be several tasks, it becomes several bubbles on the same line.

## Supported agents

| Agent | Command | Fog gate (blocks edits) | Live status line |
|---|---|---|---|
| Claude Code | `/bubble` (plugin skill) | ✅ `PreToolUse` hook | ✅ |
| Codex CLI | `$bubble` (skill) | ✅ `PreToolUse` hook on `apply_patch` | — use `bubble show` |
| Gemini CLI | `/bubble` (command + skill) | ✅ `BeforeTool` hook | — use `bubble show` |
| Anything that reads `AGENTS.md` | instructions | soft (the model is told to stop) | — use `bubble show` |

**Requirements:** Node ≥ 24. It works on Windows, macOS, Linux and WSL, and has no dependencies.

## Install

Requires Node.js 18 or newer. The skill scripts, hooks and installer use only Node built-ins, with no npm install.

### Claude Code

1. Install the plugin. Inside Claude Code, run:

   ```
   /plugin marketplace add inflamously/bubble-coding
   /plugin install bubble-tracks@bubble-tracks
   ```

   From a local checkout, use `/plugin marketplace add /path/to/bubble-tracks`. For development, run `claude --plugin-dir /path/to/bubble-tracks`.

2. Add the status line. Plugins can't set it themselves, so either run `node install.js claude --apply-statusline` or add this to `~/.claude/settings.json`:

   ```json
   "statusLine": {
     "type": "command",
     "command": "node \"/path/to/bubble-tracks/skills/bubble/scripts/cli/statusline.js\""
   }
   ```

### Codex CLI, Gemini CLI and AGENTS.md

From a checkout of this repo:

```sh
node install.js codex gemini agents-md --project /path/to/your/repo   # one repo
node install.js codex gemini --user                                   # all repos (~/.agents, ~/.codex, ~/.gemini)
node install.js all --project . --dry-run                             # preview only
```

The installer:

- copies the skill to `.agents/skills/bubble/`, which both Codex and Gemini read
- merges the fog gate into `.codex/hooks.json` and `.gemini/settings.json`
- writes `.gemini/commands/bubble.toml`
- inserts a marked block into `AGENTS.md`

Re-running it is safe, and it backs up every file it changes to `*.bak`. Codex and Gemini ask you to trust the new hook the first time.

> [!NOTE]
> Hook paths are absolute. If you commit `.codex/` or `.gemini/` to a shared repo, teammates need to re-run the installer.

## Usage

Start or resume a track in chat:

```
/bubble switch fix-generation
```

For a new track, the agent first plans in chat: it asks for the **goal**, drafts the **guards** (what not to do or touch) and the **use cases** unless you give them, then proposes the track in one short list for you to confirm or edit. Once you say ok, it creates the track with one bubble per use case, each hint naming its boundary. It asks you about each fog bubble, then walks the track one bubble at a time. It reads the guards before every action, and a guard holds even when you ask for something it rules out: that work goes to the track it belongs to. You steer with the same short commands, three ways:

| Where | Example |
|---|---|
| In chat | `bubble move 2 to 3` (the agent runs it word for word and shows the track) |
| As a command | `/bubble insert at 3 ?` (Claude Code, Gemini CLI) · `$bubble insert at 3 ?` (Codex) |
| Directly, no agent | `! node skills/bubble/scripts/cli/bubble.js fog 4:8` (in Claude Code) |

In a fresh chat, `/bubble switch <name>` picks a track back up. Hints and the handoff note carry the context between chats. When a chat gets long, the agent offers to save a handoff note and tells you to `/clear` and switch back.

### Fog types

When the agent reaches a fog bubble, you classify it. If you don't know enough to say, answer `N:?` and the agent researches it first (see **Research**):

| Type | Who does what |
|---|---|
| `known-known` | You write the bubble. |
| `known-unknown` | The agent researches or spikes options, and you pick one. |
| `unknown-known` | The agent surfaces what the codebase and docs already say, and you confirm. |
| `unknown-unknown` | The agent interviews you, one question at a time. |

The type is stored on the bubble. The skill tells the agent how to act on each type, but no code enforces it.

### Tracks

Each track is its own idea, stored as one `.json` file in `.bubble-tracks/`. `.bubble-tracks/current` names the active track, and every command, the status line and the fog gate act on it.

- **`fork`** builds on a bubble in a child track. The bubble waits until the fork is finished.
- **`diverge`** goes in a different direction from a bubble, in a side track. Nothing waits for it.
- **The last `done` closes a track** on its own, with no ask, and **`close`** ends one early. Either way it's finished for good. It becomes read-only, shows 🔒 closed, and the fog gate ignores it. `tracks` hides it from then on; `tracks --closed` or `tracks --all` lists it again. Closing a track also closes its forks (side tracks stay open), and closing a fork pops its parent bubble. There's no reopen: a follow-up is a `diverge` or a new track.

### Research

When you don't know a topic well enough to plan or build a bubble, say "let's research" (or `research 4`, plus anything you want it to focus on). The agent looks things up for that one bubble, with subagents if it has them, and brings back at least two or three guides or tips with their sources. Each one is noted on the bubble with `finding`, so it stays in the bubble's context. The agent then proposes new bubbles or a fork, and you decide. Research only adds to what you asked for. It never renames a bubble, rewrites your hint or fills fog.

### Abilities

An ability is a reusable workflow, like an agent skill, that you apply to the active bubble or the whole track. Drop a `<name>.md` file into `.bubble-tracks/abilities/` (project) or `~/.bubble-tracks/abilities/` (user). When both have the same name, the project one wins.

```markdown
---
name: ready
description: Check the active bubble is ready to build
type: bubble
---
Restate the bubble's task in one line, and list the files it will touch.
Flag anything its hint leaves open as a question for the human.
```

`type: bubble` runs against the active bubble, and `type: track` runs against the whole track. Write `bubble:ready` (or `/bubble:ready`) in chat, plus any extra words to steer it. The agent runs the workflow once, reports back and stops. Nothing stays attached. `abilities` lists the ones it can find, and flags broken files with the reason.

<details>
<summary><b>CLI reference</b></summary>

```
node skills/bubble/scripts/cli/bubble.js <command> [--dir <repo>] [--ascii]
```

A leading `bubble` word is optional, and a whole phrase can be passed as one quoted argument.

| Command | Effect |
|---|---|
| `show` | Render the track and list its bubbles (exit 3 = active bubble is fog) |
| `switch [name] [title]` | Resume a track, or create it (no name: the current one). Refuses a new name close to an open track (`flow` for `flow-analysis`); `create` makes it |
| `create <name> [title]` | Create a new track (refuses if it exists) |
| `tracks` · `--closed` · `--all` | List tracks, current marked `→`; closed ones are hidden unless `--closed` (only closed) or `--all` |
| `close <name> --force` | Finish a track for good: read-only, closes its forks, pops its parent bubble |
| `delete <name> --force` | Delete a track (not the current one) |
| `fork [N] <name>` | Build on bubble N in a child track; the bubble waits for it |
| `diverge [N] <name> [title]` | Go a different direction from bubble N in a side track; nothing waits |
| `init <title>` | Create the default track (`.bubble-tracks/track.json`) |
| `add <title>` · `add ? <why>` | Append a todo (or fog) bubble; a fog says why it's unclear |
| `insert at N <title>` · `insert at N ? <why>` | Insert a todo (or fog) bubble at position N |
| `remove N` · `remove N:M` | Delete a bubble or a range (not while its fork or side track is open) |
| `move N to M` · `move N:M to M` | Move a bubble or block so it starts at position M |
| `move N --to <track>` · `move N:M --to <track>` | Move a bubble or block to the end of another track |
| `rename N <title>` | Retitle a planned bubble |
| `title <text>` | Rename the track itself |
| `goal <text>` | Set the one end result every bubble serves, once (a new goal is a new track; `--force` rewords it) |
| `guard <text>` · `guard N <text>` · `guard show` | Add a rule of what not to do, rewrite guard N, or list them |
| `guard drop N` · `guard drop --all` | Drop guard N, or all of them (`--all` needs `--force`) |
| `handoff <note>` · `handoff -` | Save (or clear) the note a fresh chat resumes from |
| `hint N <text>` · `hint N -` | Attach (or clear) a note for that bubble |
| `fog [N \| N:M] [TYPE]` | Turn bubbles into fog (done bubbles need `--force`; not while its fork is open) |
| `why [N] <text>` · `why [N] -` | Say (or clear) why a fog bubble is unclear |
| `type [N] <TYPE>` | Set the fog type: `kk` · `ku` · `uk` · `uu` (or the full names) |
| `answer [N] <text>` · `answer [N] -` | Keep (or clear) your own words on a fog that stays fog |
| `fill [N] <title>` | Plan a fog bubble with your content: fog → todo |
| `done` | Pop the active bubble, then ⏸ stop; the last one closes the track |
| `research [N] [focus]` | Print the research workflow and bubble N's context, to run once |
| `finding N <text>` · `finding N M -` · `finding N -` | Note (or drop) what research found for bubble N |
| `abilities` | List the abilities: name, type, project or user, description |
| `bubble:<name> [text]` | Print an ability's workflow and its context, to run once |

- `N` is the Nth bubble on the track. Omitted, it means the active bubble. `N:M` is N through M, inclusive.
- `--to <track>` (or `--to=<track>`) on `add`, `insert` and `hint` writes into another existing track, and the current track stays current.
- A word that starts with `-` is an option. Put text like that after `--`: `hint 2 -- use -v for verbose`.

</details>

<details>
<summary><b>Track file format</b></summary>

```json
{
  "title": "Fix generation",
  "bubbles": [
    { "title": "Repro", "state": "done" },
    { "title": "???", "state": "fog", "type": "unknown-unknown" },
    { "title": "Patch", "state": "todo" }
  ]
}
```

The active bubble is the first one that isn't done. Edit tracks through the CLI, not by hand.

</details>

<details>
<summary><b>Colors and symbols</b></summary>

In the status line and the terminal, the track title is green, the track is blue, and `prev ‹ active › next` is yellow.

- `NO_COLOR=1` (or `--no-color` on `statusline.js`) turns colors off.
- `BUBBLES_COLOR=1` forces them on.
- `BUBBLES_ASCII=1` swaps the symbols for plain ASCII: `S *--@--?--o F`. In Claude Code, set it with `"env": { "BUBBLES_ASCII": "1" }` in settings.

</details>

## Development

The source is TypeScript in `src/`. It builds into `skills/bubble/scripts/`, and that JS is committed, because it's what the hooks, the status line and installed copies run. The installer (`src/skill-install/`) builds separately into `skill-install/`, so it isn't copied along with the skill. Users never need a build step.

```sh
npm install     # dev only: typescript + @types/node
npm run build   # src/ -> skills/bubble/scripts/ and skill-install/
npm test        # node --test; fails if the committed JS drifts from src/
npm run site    # build the demo site; preview with: python3 -m http.server -d dist/pages
```

Edit `src/`, never the generated JS, and commit both together. For a walkthrough of the code, see [`docs/`](docs/1-big-picture-map.md).

> [!WARNING]
> The fog gate covers file-edit tools only, and that's on purpose: it's a guardrail, not a security boundary. Writes made through shell commands (Bash, `run_shell_command`, PowerShell) aren't blocked. No hook can stop an agent for sure (any interpreter can write a file), and shell write detection can't cover every platform's shell.

## License

MIT, see [LICENSE](LICENSE).
