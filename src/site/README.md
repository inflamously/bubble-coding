# src/site/

The GitHub Pages demo: the real bubble-tracks CLI in an emulated terminal, playing `demo/story.md`.
TypeScript (`.mts`) in three standalone folders, each with its own tsconfig that limits what it may use.
tsc only type-checks them; `build.mjs` bundles them with esbuild.

| Folder | What it is | May use |
|---|---|---|
| `bubble-web/` | The CLI (`src/lib/cli/main.ts`, bundled in) on an in-memory machine: fake `node:fs`, POSIX `node:path`, per-run `process` and `console` (`host.mts`) | the language only (no DOM, no Node) |
| `terminal/` | The page: `index.html`, `style.css` and the modules behind them (terminal, shell, disk panel, player, header) | the DOM; imports `bubble-web/` |
| `build/` | Node code `build.mjs` runs at build time: parses the story | Node |

```
npm run site                          # type-check, then bundle into dist/pages/
python3 -m http.server -d dist/pages  # preview at http://localhost:8000
npm run deploy                        # redeploy GitHub Pages from master (gh workflow run)
```

Every push to `master` deploys too: `.github/workflows/pages.yml` runs the tests, `npm run site`,
and publishes `dist/pages/`. One-time setup: Settings → Pages → Source: GitHub Actions.

`test/web.test.js` type-checks all three, bundles bubble-web the way the page does, and replays every
`bubble …` line of the story on both bubble-web and the real CLI; the output and the files on disk must match.
