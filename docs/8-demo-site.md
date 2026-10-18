# 8. Demo site

The GitHub Pages demo plays `demo/story.md` in a fake terminal, using the **real CLI**: the committed JS from `skills/bubble/scripts/` runs unchanged in the browser. Only what Node provides is swapped out.

It is TypeScript (`.mts` → ES modules) in three folders. Each has its own tsconfig, which limits what that folder may use:

| Folder | What it is | May use (`lib` / `types`) |
|---|---|---|
| `bubble-web/` | the CLI on an in-memory machine | the language only: no DOM, no Node |
| `terminal/` | the page: HTML, CSS, terminal, shell, disk panel, player, header | the DOM; imports `bubble-web/` |
| `build/` | Node scripts that assemble `dist/pages/` | Node |

All three extend `tsconfig.base.json` and emit into `dist/site/`. The tsconfigs are the architecture: `bubble-web` can't touch `document` or `fs` because the compiler won't let it.

```
npm run site                          # tsc ×3 → dist/site/, then node dist/site/build/build.mjs → dist/pages/
python3 -m http.server -d dist/pages  # preview (fetch() needs HTTP, file:// fails)
npm run deploy                        # gh workflow run pages.yml
```

## bubble-web: the CLI without Node

`createMachine(sources, { cwd })` returns a `Machine` with `fs`, `path`, `cwd()`, `cd()` and `bubble(argv)`. Each `bubble()` call is one "process":

```ts
runCommonJs(sources, 'bubble.js', builtins, { process: proc, console: fakeConsole }, path);
```

| Node piece | Replaced by |
|---|---|
| `require` | `runCommonJs`: a tiny CommonJS loader. Each file is wrapped in `new Function('exports','require','module','process','console', src)`, with a **fresh module cache per run** (like a new process). `'fs'`/`'node:fs'`/`'path'`/`'node:path'` come from `builtins`; `./x` resolves against the requiring file; anything else throws `no module …`. |
| `node:fs` (`fs.mts`) | a `Map<path, content>` of files plus a `Set` of dirs. Only the sync calls the CLI makes: `existsSync`, `statSync`, `mkdirSync`, `readdirSync`, `readFileSync`, `writeFileSync`, `renameSync`, `unlinkSync`. Errors carry Node's `code` (`ENOENT`, `EISDIR`, `EEXIST`), so the CLI's `err.code` checks still work. |
| `node:path` (`path.mts`) | POSIX `normalize/resolve/join/dirname/basename/relative`, resolving against the machine's cwd |
| `process` | `argv`, `env.BUBBLES_COLOR`, `cwd()`, `pid: 1`, `exitCode`, `stdout.isTTY` |
| `console` | `log` → stdout, `error`/`warn` → stderr; one `Output` entry per call |

The run returns `{ out, code: exitCode ?? 0 }`. If the CLI throws, that becomes `bubble-web: <message>` with exit 1.

This works because of rules set earlier in the tour: the CLI is committed CommonJS, uses only `fs` and `path`, has no async I/O, and reports failure through `process.exitCode` instead of `process.exit()`. `store.js` writes a `<file>.<pid>.tmp` and then renames it, which is why `pid` and `renameSync` exist.

`words.mts` is the shell's word splitter (spaces separate words, `'…'`/`"…"` group them). The test uses it too, so the story is parsed the same way in both places.

## terminal: the page

`main.mts` loads `cli-sources.json` and `story.json`, then wires five parts:

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

`build.mts` (it runs as `dist/site/build/build.mjs`):

1. Wipes `dist/pages/`, copies `style.css` and the compiled `terminal/` + `bubble-web/` modules.
2. `story.json` ← `parseStory(demo/story.md)` (`build/story.mts`): `## N. Title` starts a scene, `> who: text` is a caption, each line in a code block is a command, and any other paragraph is a note. Backticks are removed.
3. `cli-sources.json` ← `cliSources()` (`build/sources.mts`): `bubble.js` + `lib/**/*.js`, keyed by forward-slash path. `fog-gate.js` and `statusline.js` are left out because the page never runs them.
4. `.nojekyll`, so Pages serves the files as they are.
5. **Cache busting:** it hashes every output file (plus the source `index.html`) into `?v=<10 hex>`. It rewrites `index.html` to load `style.css?v=…` and `main.mjs?v=…`, and adds an **import map** that maps every `./x.mjs` to `./x.mjs?v=…`, so the relative imports pick up the version too. `main.mjs` reads its own `?v=` from `import.meta.url` and appends it to the JSON fetches. If the `href`/`<script>` it searches for has moved, the build throws instead of shipping an unversioned page.

Deploy: `.github/workflows/pages.yml` runs on every push to `master` (or manually): `npm ci` → `npm test` → `npm run site` → upload `dist/pages`.

## The test that keeps it honest

`test/web.test.js` compiles all three folders (so the type check is part of `npm test`). It then takes every `bubble …` line from `demo/story.md` and runs it twice, once with the real `node bubble.js` in a temp dir and once on bubble-web, with color off. It asserts that stdout, stderr and the exit code are equal, and that the `.bubble-tracks/` files end up byte-identical. Two things are normalized first: the temp dir path is replaced with the fake one, and the handoff timestamp is masked.

This is the "fails if one byte differs" promise in the page footer.

## Things worth knowing

- **New Node usage in the CLI breaks the site.** A new builtin (`os`, `crypto`, `child_process`), a new `fs` call (`readdirSync` with options, `appendFileSync`, `rmSync`…), `process.exit()` or async I/O is either missing from the fake or throws `bubble-web: …`. The test only catches this if a story line runs that code path.
- **The test only covers what the story runs.** Commands the story doesn't use (`close`, `delete`, `diverge`…) are never compared, but visitors can still type them in the playground.
- **Color is never compared.** The test runs with `color: false`, and the page runs with color on.
- **The in-memory fs is lenient.** `writeFileSync` onto a directory path or `mkdirSync({recursive})` through a file path succeeds instead of failing like Node does. The CLI doesn't do this today.
- **"Last changed" in the disk panel means last in alphabetical order** among the files that changed (not the most recent write), skipping `current`.
- **Stale wording in `demo/story.md`:** its intro talks about "the demo script (bubble 2)" and "the recording", which come from an older plan.
