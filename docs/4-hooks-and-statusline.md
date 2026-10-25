# 4. Hooks and statusline

Two small entry points sit beside the CLI. Each is about 25 lines, and the logic they use lives in `lib/`. Agents run them; humans don't.

| File | Agent calls it… | Output |
|---|---|---|
| `src/cli/fog-gate.ts` | before every file-editing tool call | exit `0` = allow, exit `2` + stderr = block |
| `src/cli/statusline.ts` | whenever Claude Code redraws its status line | one line on stdout: the rendered track |

## The fog gate

### Why it exists

The core rule of bubble-tracks is **the agent never plans fog itself**. A `❓` bubble means the human hasn't decided what that step is. The agent's job there is to stop and ask (step 3 in SKILL.md).

SKILL.md only gives the agent instructions, and agents don't always follow them. Late in a long chat, after the context has been summarised, or when an agent is eager to finish, it will happily make up the missing step and start coding it. Then the whole point of fog is lost: you get code for a plan nobody made.

The gate makes that rule something the harness enforces, not just a request. While the **active bubble of the current track is fog**, the agent's harness rejects every edit to a project file. The stderr message is fed back to the agent as the reason:

```
Active bubble "???" is unplanned — plan it with the user first (bubble fill).
Do not plan fog yourself: ask the human to classify it (known-known, …) and give the content.
```

So the agent is steered back to the conversation exactly when it was about to skip it. Once the human runs `fill`, the bubble becomes a todo and edits go through again.

### The rules, in code order

```ts
const found = lib.findTrack(root);
if (!found || !found.track || found.track.closed) return 0;   // 1
const targets = extractTargetPaths(input, root);
if (targets.length && targets.every((f) => isInsideBubblesDir(f, found.file))) return 0;   // 2
const active = lib.activeBubble(found.track);
if (!active || active.state !== 'fog') return 0;              // 3
process.stderr.write(`Active bubble "${active.title}" is unplanned …`);
return 2;                                                      // 4
```

1. **No track, an unreadable track, or a closed track lets everything through.** A repo that doesn't use bubble-tracks is never affected. A closed track is an archive, so it gates nothing.
2. **Edits that only touch `.bubble-tracks/` are allowed.** Editing the plan is how fog gets resolved. If a patch touches the plan *and* `src/`, it's still blocked.
3. **It only checks the active bubble.** Fog further down the track doesn't block anything until the track reaches it.
4. **Otherwise the edit is blocked.** All three agents treat exit code 2 as "deny" and pass stderr on to the model.

On any internal error, `main().catch(() => process.exit(0))` **fails open**. The gate is a guardrail, not a security boundary. A bug in it must never stop someone from editing their own repo.

### How each agent wires it

| Agent | Hook | Matcher | Where |
|---|---|---|---|
| Claude Code | `PreToolUse` | `Edit\|Write\|MultiEdit\|NotebookEdit` | `.claude-plugin/plugin.json` (comes with the plugin) |
| Codex CLI | `PreToolUse` | `apply_patch\|Edit\|Write` | `.codex/hooks.json`, written by the installer |
| Gemini CLI | `BeforeTool` | `write_file\|replace` | `.gemini/settings.json`, written by the installer |

### What it doesn't cover

- **Shell commands, on purpose.** The matchers only list file-editing tools, so `sed -i`, `echo >` or a script run through Bash are never checked. Spotting writes in shell commands was tried and dropped: it can't cover every platform's shell (PowerShell, cmd), and any interpreter can write a file anyway. The gate nudges the agent back to the human on the common path; it doesn't try to be a wall.
- **Only the current track counts.** Fog on any other track blocks nothing. An agent that runs `switch` to a track whose active bubble isn't fog is no longer blocked.
- **Any file in the repo is blocked, related or not.** While fog is active, even editing a README unrelated to the track is refused. The gate doesn't know what the bubble is about; it only knows the plan has a gap.
- **Agents can edit the plan by hand.** Rule 2 lets the agent edit `.bubble-tracks/*.json` directly, although SKILL.md says all changes should go through the CLI. The CLI itself writes with Node `fs`, not with an agent tool, so it never meets the gate.

## The status line

`statusline.ts` is a Claude Code `statusLine` command. It reads the payload on stdin, finds the workspace (`resolveRoot`), loads the current track and prints `lib.render(track)`:

```
Src tour   S ●──●──●──◐──○──○──○──○ F   Store and IO ‹ ◐ Hooks and statusline › Ops and rendering
```

- **It always prints something.** No track gives an empty line. A broken file prints `bubbles: invalid <name>.json`. On an exception it prints `\n`. A status line command that crashes would show an error in the UI.
- **Options:** `--ascii` switches to `*--?` symbols. `--no-color` turns off ANSI colours. Colour is on by default, because Claude Code renders it.
- **A plugin can't set the status line**, so `skill-install/agents/claude.ts` only prints the `settings.json` snippet. It writes the snippet itself only with `--apply-statusline`.
- **Codex and Gemini have no status line hook.** That's why SKILL.md tells agents to paste the track line after every change.
