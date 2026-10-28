# 6. CLI entry

The CLI is what agents and humans actually run: `node skills/bubble/scripts/cli/bubble.js <command>`. That JS is compiled from `src/cli/bubble.ts` (tsconfig `outDir: skills/bubble/scripts`, run by `npm run build`) and committed, so the skill works without a build step. `test/build.test.js` fails if the committed JS drifts from `src/`.

| File | Job |
|---|---|
| `src/cli/bubble.ts` | entry: calls `run()` |
| `src/lib/cli/main.ts` | `run()`: parse, build the context, dispatch, turn errors into exit 1. Shared with the demo site, which bundles it |
| `src/lib/cli/args.ts` | `HELP` text, `parseArgs`, address helpers (`isAddr`, `isRange`, `needAddr`), the `Ctx` type |
| `src/lib/cli/tracks.ts` | **track-level** commands: `init` `create` `switch` `tracks` `fork` `diverge` `close` `delete` |
| `src/lib/cli/bubbles.ts` | **bubble-level** commands on the current track: `show` `add` `insert` `remove` `move` `rename` `title` `handoff` `hint` `fog` `type` `fill` `done` |
| `src/lib/cli/print.ts` | `printTrack`: what `show` and every change print, and the exit 3 for fog |

## The entry: bubble.ts → main.ts

`bubble.ts` only calls `run()` from `lib/cli/main.ts`, which wraps `main()`:

```ts
const { cmd, args, opts } = parseArgs(process.argv.slice(2));
if (!cmd || opts.help || cmd === 'help') { console.log(HELP); return 0; }
const color = process.env.BUBBLES_COLOR === '1' || (process.env.BUBBLES_COLOR !== '0' && !!process.stdout.isTTY);
const ctx: Ctx = { dir: path.resolve(opts.dir || process.cwd()), opts, renderOpts: { ascii: …, color } };
return runTrackCommand(cmd, args, ctx) ?? runBubbleCommand(cmd, args, ctx);
```

- **Dispatch is a two-step fallthrough.** `runTrackCommand` returns `undefined` for a command it doesn't know, and `??` hands it to `runBubbleCommand`, whose `default:` throws `unknown command`.
- **Colour is for humans only.** It's on when stdout is a terminal. An agent reads piped output, so it gets plain text. `BUBBLES_COLOR=1/0` forces it, and `NO_COLOR` (checked in `render.ts`) always wins.
- **One error path.** Anything thrown anywhere (ops, links, store, JSON parsing) is caught here and printed as `bubble: <message>` with exit 1. That's why every `throw` in `lib/` is written as a sentence the agent can act on.

## Parsing: args.ts

`parseArgs` is a small hand-written loop, no library:

1. **Flags** are pulled out wherever they are: `--ascii`, `--fog`, `--force`, `--help`/`-h`, and `--dir <path>`, `--at <N>` (which take the next word). Any other `--x` is an error.
2. **A single quoted phrase is split.** `bubble.js "move 2 to 5"` becomes `move 2 to 5`. This only happens when there is exactly one positional argument and it contains whitespace.
3. **A leading `bubble` is dropped**, so `bubble move 2 to 5` (the human's wording, pasted unchanged) works.
4. The first word is `cmd`, the rest is `args`.

So all of these are the same call:

```
bubble.js move 2 to 5
bubble.js "move 2 to 5"
bubble.js bubble move 2 to 5
bubble.js "bubble move 2 to 5"
```

The filler words (`to` in `move`, `at` in `insert`) are dropped by each command, not by the parser. Undocumented aliases: `status` = `show`, `rm` = `remove`, `mv` = `move`.

## The two command files

**`tracks.ts`** works on which track is current and on whole files. It computes `bubblesDir` (the nearest `.bubble-tracks/` up from `--dir`, or a new one in `--dir`) and mostly calls `store.ts` directly: `saveTrack`, `setCurrent`, `loadTrack`. `fork`/`diverge` are here because they create a file, but they use `ops.markFork`/`markDiverge` to change the bubble.

**`bubbles.ts`** always follows the same shape:

```
findTrack(dir)              → which file is current, loaded       (no track / invalid → throw)
switch (cmd) { … lib.<op>(track, …) … }   → change in memory, get msg
if (track.closed) throw     → nothing gets written
saveTrack(file, track)
after?.()                   → cross-track follow-up (fork syncs, parent pops)
print msg, printTrack, ⏸ STOP (done only)
return 0
```

Each `case` does only the parsing specific to that command (`?` means fog, `at`/`to` dropped, optional `N` peeled off with `isAddr`) and then calls one op from stop 5.

## Printing and exit codes: print.ts

`printTrack` prints, in order: the one-line `render`, `⑂ fork of …` or `↗ diverged from …` if the track has a parent or origin, a blank line, the `list`, then either the `🔒 closed` line or the `✎ handoff` note, and finally a `⚠ … is fog` warning.

| Exit | When |
|---|---|
| `0` | success |
| `1` | any thrown error, or `close` when some fork couldn't be closed |
| `3` | the active bubble is fog, from `show` **and** from `switch` when it resumes a track |

Changes ignore `printTrack`'s return value and always exit 0, so a successful `fog 5` doesn't look like a failure. `HELP` says "3 (show only)", but `switch` returns `printTrack(...)` too.

## Tracing one command: `done`

`node bubble.js done` on this track, with "CLI entry" active:

1. **`main.ts`**: `parseArgs` → `{ cmd: 'done', args: [], opts: {} }`. Not `help`, so it builds `ctx` (dir = cwd, no colour because an agent pipes the output).
2. **`runTrackCommand('done', …)`**: no matching case → `undefined`.
3. **`runBubbleCommand('done', …)`**:
   1. `lib.findTrack(dir)` walks up to `.bubble-tracks/`, reads `current` (`src-tour`) and loads `src-tour.json`.
   2. `case 'done'`: gets the active bubble. `links.checkForkFinished` returns at once because it has no `fork`. If it had one, it would load the child and throw unless every bubble there is done (or the child is closed).
   3. `lib.done(track)`: throws if everything is already done or the active bubble is fog; otherwise sets `state = 'done'` → `popped "CLI entry"`.
   4. `after` is set to `links.closeIfDone` then `links.popFinishedParents`, and `stop = true`.
   5. Not closed → `lib.saveTrack` writes the file (tmp file + rename, stop 3).
   6. `after()`: this track isn't finished, so it stays open and nothing pops. Had this been its last bubble, it would close (with its open forks) and print `all done — closed track …`. If this had been a fork's last bubble, its parent bubble would be set to done and saved, and so on up the chain, each adding a `fork finished — popped …` line.
   7. Prints the message, a blank line, then `printTrack`.
   8. Something is still active → prints the `⏸ stop — show this track to the human and wait…` line. That line is how the CLI enforces SKILL.md step 4: the agent reads it as the last thing in the output.
4. Back in **`main.ts`**: `process.exitCode = 0`.

## Things worth knowing

- **The quoted-phrase split is all or nothing.** `bubble.js "hint 3" "some text"` is two positionals, so nothing is split and `cmd` is `hint 3`, an unknown command.
- **`add ? foo` is fog with a reason.** A leading `?` makes fog, and the words after it are its `why`. `--fog foo` still names the fog `foo` instead.
- **`switch <name> <title>` ignores the title when the track already exists.** The title is only used when `switch` creates the track.
- **`switch` refuses a new name close to an open track.** Before it creates one, `refuseNearMiss` asks `lib.nearMisses` (`near.ts`): an open track whose name starts with the new one, or is within an edit distance of 0, 1 or 2 by length. Closed tracks don't count. `create` skips the check, so it's the way to make that name anyway. Names ignore case: `lib.sameName` maps `Dev` to a stored `dev` first, so `switch` resumes it under its stored name and `create` refuses the twin (on macOS and Windows they'd be one file).
- **An unknown command with no track gives the wrong error.** `runBubbleCommand` looks up the track before it reaches `default:`, so a typo in a repo without tracks prints `no bubble track found` instead of `unknown command`.
- **`after` runs once the track is saved.** If a follow-up fails (say a parent file can't be written), this track's change is already on disk and the command still exits 1.
