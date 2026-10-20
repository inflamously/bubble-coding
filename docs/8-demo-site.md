# 8. Demo site

The GitHub Pages demo plays `demo/story.md` in a fake terminal, using the **real CLI**: esbuild bundles the CLI's own source (`src/lib/cli/main.ts`) into the page. Only what Node provides is swapped out.

It is TypeScript (`.mts`) in three folders. Each has its own tsconfig, which limits what that folder may use:

| Folder | What it is | May use (`lib` / `types`) |
|---|---|---|
| `bubble-web/` | the CLI on an in-memory machine | the language only: no DOM, no Node |
| `terminal/` | the page: HTML, CSS, terminal, shell, disk panel, player, header | the DOM; imports `bubble-web/` |
| `build/` | Node code `build.mjs` runs to assemble `dist/pages/` | Node |

All three extend `tsconfig.base.json`, which is `noEmit`: tsc only type-checks them, and `build.mjs` bundles them with esbuild. The tsconfigs are the architecture: `bubble-web` can't touch `document` or `fs` because the compiler won't let it.

```
npm run site                          # tsc --noEmit ×3, then esbuild → dist/pages/
python3 -m http.server -d dist/pages  # preview (module scripts need HTTP, file:// fails)
npm run deploy                        # gh workflow run pages.yml
```

## bubble-web: the CLI without Node

`createMachine({ cwd })` returns a `Machine` with `fs`, `path`, `cwd()`, `cd()` and `bubble(argv)`. Each `bubble()` call is one "process":

```ts
withHost({ fs, path, process: proc, console: fakeConsole }, run);
```

`run` is the CLI's `run()` from `src/lib/cli/main.ts`. bubble-web imports it as `bubble-cli`, a name only `build.mjs` resolves (`cli.d.mts` types it), so the site's tsconfigs never type-check Node code. The same esbuild options (`browserOptions` in `build.mjs`) swap what Node provides:

| Node piece | Replaced by |
|---|---|
| `node:fs` | `node-fs.mts`, forwarding to the machine's disk (`fs.mts`): a `Map<path, content>` of files plus a `Set` of dirs. Only the sync calls the CLI makes: `existsSync`, `statSync`, `mkdirSync`, `readdirSync`, `readFileSync`, `writeFileSync`, `renameSync`, `unlinkSync`. Errors carry Node's `code` (`ENOENT`, `EISDIR`, `EEXIST`), so the CLI's `err.code` checks still work. |
| `node:path` | `node-path.mts`, forwarding to `path.mts`: POSIX `normalize/resolve/join/dirname/basename/relative`, resolving against the machine's cwd |
| `process` | injected from `globals.mts` (esbuild `inject`): `argv`, `env.BUBBLES_COLOR`, `cwd()`, `pid: 1`, `exitCode`, `stdout.isTTY` |
| `console` | injected the same way: `log` → stdout, `error`/`warn` → stderr; one `Output` entry per call |

All four go through `host.mts`. `withHost` points them at one command's machine for the length of the synchronous run, and anything that touches them outside a run throws. The run returns `{ out, code: exitCode ?? 0 }`. If bubble-web itself throws, that becomes `bubble-web: <message>` with exit 1.

This works because of rules set earlier in the tour: the CLI uses only `fs` and `path`, keeps no state in its modules, has no async I/O, and reports failure through `process.exitCode` instead of `process.exit()`. `store.js` writes a `<file>.<pid>.tmp` and then renames it, which is why `pid` and `renameSync` exist.

`words.mts` is the shell's word splitter (spaces separate words, `'…'`/`"…"` group them). The test uses it too, so the story is parsed the same way in both places.

## terminal: the page

`main.mts` gets the story from `STORY` (inlined by `build.mjs` with esbuild's `define`), then wires five parts:

| Module | Job |
|---|---|
| `terminal.mts` | the screen: `line()` (ANSI → spans via `ansi.mts`), `print()`, `clear()`, plus the `typed` span the player "types" into |
| `shell.mts` | a mini shell over a `Machine`: `bubble`, `ls [-a]`, `cat`, `cd`, `pwd`, `clear`, `help`, `reset`, `replay`. `boot()` makes a **new machine** with `~/todo-app/README.md`. Every `exec()` calls `hooks.ran()`. |
| `disk.mts` | the `.bubble-tracks/` side panel. After each command it re-reads the folder, diffs it against the last snapshot, flashes the files that changed and opens one (unless the visitor pinned one). It tags the `current` track and highlights the JSON with a regex. |
| `player.mts` | plays the story (below) |
| `header.mts` | the scene strip, drawn as its own bubble track (S ●●◐○ F), plus Play/Back/Step/Skip/Restart/Speed |

`text.mts` holds the fixed text (intro, `help`, the figlet banner), and `dom.mts` has `$`/`el`/`button`. The keyboard handling is in `main.mts`: Enter, ↑/↓ history, Ctrl+L, Ctrl+C. Typing while the story plays pauses it, and during the intro any key starts it.

### The player

The story becomes one flat list of **beats**: a `scene` beat, then that scene's `say` and `run` steps.

- **Play**: `perform()` types a command one character at a time (`PACE.key`/`space`, skipped if `prefers-reduced-motion`), runs it, then waits (`pauseAfter`: captions scale with length, `bubble done`/`cat` get longer). Speed 2× divides every wait.
- **Interrupting**: each play/pause/jump bumps `this.run`. Every `await` checks `run === this.run`, so an older run stops at its next wait. No timers need cancelling. A half-played beat plays again from the start.
- **Step/Skip** show beats instantly (`show()`), with no typing.
- **Back/Jump** can't undo a command, so they **reboot the disk** and replay every beat before the target instantly, then carry on. State = replaying the commands, never a snapshot.

## build: assembling dist/pages/

`buildSite()` in `build.mjs` (`npm run site` type-checks first):

1. `parseStory(demo/story.md)` (`build/story.mts`, bundled and imported on the fly by `importTs`): `## N. Title` starts a scene, `> who: text` is a caption, each line in a code block is a command, and any other paragraph is a note. Backticks are removed.
2. Wipes `dist/pages/` and runs esbuild with `browserOptions` on two entries: `terminal/main.mts` → `main-<hash>.js` (the page, bubble-web, the CLI and the story in one file) and `terminal/style.css` → `style-<hash>.css`.
3. Writes `index.html` with `style.css` and `main.js` swapped for the hashed names (from esbuild's metafile). The hash changes whenever the content does, so a browser never mixes a new page with stale cached files. If the `href`/`src` it looks for has moved, the build throws.
4. `.nojekyll`, so Pages serves the files as they are.

Deploy: `.github/workflows/pages.yml` runs on every push to `master` (or manually): `npm ci` → `npm test` → `npm run site` → upload `dist/pages`.

## The test that keeps it honest

`test/web.test.js` type-checks all three folders (so the type check is part of `npm test`) and bundles bubble-web with the page's esbuild options. It then takes every `bubble …` line from `demo/story.md` and runs it twice, once with the real, committed `node bubble.js` in a temp dir and once on bubble-web, with color off. It asserts that stdout, stderr and the exit code are equal, and that the `.bubble-tracks/` files end up byte-identical. Two things are normalized first: the temp dir path is replaced with the fake one, and the handoff timestamp is masked.

This is the "fails if one byte differs" promise in the page footer.

## Things worth knowing

- **New Node usage in the CLI breaks the site.** A new builtin (`os`, `crypto`, `child_process`) fails the bundle, since only `node:fs` and `node:path` resolve. A new `fs` or `path` call (`appendFileSync`, `rmSync`…) also fails the bundle, because `node-fs.mts` doesn't export it. A new `process` member, `process.exit()` or async I/O only fails at run time, and the test only catches that if a story line runs that code path.
- **The test only covers what the story runs.** Commands the story doesn't use (`close`, `delete`, `diverge`…) are never compared, but visitors can still type them in the playground.
- **Color is never compared.** The test runs with `color: false`, and the page runs with color on.
- **The in-memory fs is lenient.** `writeFileSync` onto a directory path or `mkdirSync({recursive})` through a file path succeeds instead of failing like Node does. The CLI doesn't do this today.
- **"Last changed" in the disk panel means last in alphabetical order** among the files that changed (not the most recent write), skipping `current`.
- **Stale wording in `demo/story.md`:** its intro talks about "the demo script (bubble 2)" and "the recording", which come from an older plan.
