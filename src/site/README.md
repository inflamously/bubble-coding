# src/site/

The GitHub Pages demo: the real bubble-tracks CLI in an emulated terminal, playing `demo/story.md`.
TypeScript (`.mts`, compiled to ES modules) in three standalone folders, each with its own tsconfig:

| Folder | What it is | May use |
|---|---|---|
| `bubble-web/` | The committed CLI JS running on an in-memory machine: fake `node:fs`, POSIX `node:path`, per-run `process` and `console` | the language only (no DOM, no Node) |
| `terminal/` | The page: `index.html`, `style.css` and the modules behind them (terminal, shell, disk panel, player, header) | the DOM; imports `bubble-web/` |
| `build/` | Node scripts that assemble `dist/pages/`: packs the CLI sources and parses the story into JSON | Node |

```
npm run site                          # tsc each folder into dist/site/, then assemble dist/pages/
python3 -m http.server -d dist/pages  # preview at http://localhost:8000
npm run deploy                        # redeploy GitHub Pages from master (gh workflow run)
```

Every push to `master` deploys too: `.github/workflows/pages.yml` runs the tests, `npm run site`,
and publishes `dist/pages/`. One-time setup: Settings → Pages → Source: GitHub Actions.

`test/web.test.js` compiles all three and replays every `bubble …` line of the story on both
bubble-web and the real CLI; the output and the files on disk must match.
