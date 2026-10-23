// Every build in one place:
//   node build.mjs        tsc: src/ → skills/bubble/scripts/ and src/skill-install/ → skill-install/ (committed)
//   node build.mjs site   tsc type-checks src/site/, then esbuild bundles it with the CLI and demo/story.md → dist/pages/
//   node build.mjs check  just the src/site/ type check (the CLI builds above type-check as they emit)
// Plain JS so it runs on a fresh clone with nothing compiled yet. The tests import it to build into temp dirs.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Each committed folder and the tsconfig that builds it. tsc, not esbuild: one .js per .ts with the
 * comments kept, since agents read what they run, and hooks and tests import single modules.
 */
export const CLI_BUILDS = [
  { config: 'tsconfig.json', out: 'skills/bubble/scripts' },
  { config: 'tsconfig.skill-install.json', out: 'skill-install' },
];

/** The demo site's folders; each tsconfig limits what its folder may use (see src/site/README.md). */
export const SITE_CONFIGS = ['src/site/bubble-web', 'src/site/terminal', 'src/site/build'];

const BUBBLE_WEB = path.join(ROOT, 'src', 'site', 'bubble-web');

/** Bundles bubble-web's CLI from src/lib/cli/main.ts with node:fs and node:path swapped for the machine's (see host.mts),
 *  and node:util for @pkgjs/parseargs. */
const machine = {
  name: 'bubble-web-machine',
  setup(build) {
    build.onResolve({ filter: /^bubble-cli$/ }, () => ({ path: path.join(ROOT, 'src', 'lib', 'cli', 'main.ts') }));
    build.onResolve({ filter: /^node:(fs|path|util)$/ }, (args) => ({ path: path.join(BUBBLE_WEB, `node-${args.path.slice(5)}.mts`) }));
  },
};

/** esbuild options for anything that includes bubble-web: the page, and the tests' copy of it. */
export const browserOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  plugins: [machine],
  inject: [path.join(BUBBLE_WEB, 'globals.mts')],
};

/** Run tsc with `args`; throws with its output if it fails. */
function tsc(...args) {
  const bin = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`tsc ${args.join(' ')} failed:\n${r.stdout}${r.stderr}${r.error ?? ''}`);
}

// Committed JS.

/** Build one of CLI_BUILDS into `outdir` (default: its committed folder), from scratch so no stale module survives. */
export function buildCli(build, outdir = path.join(ROOT, build.out)) {
  fs.rmSync(outdir, { recursive: true, force: true });
  tsc('-p', build.config, '--outDir', outdir);
}

// The demo site.

export function checkSite() {
  for (const config of SITE_CONFIGS) tsc('-p', config, '--noEmit');
}

/**
 * esbuild, with warnings fatal: a node:fs call the machine doesn't provide (say fs.rmSync) is only an
 * "always undefined" warning to esbuild, but a crash in the browser.
 */
async function bundle(options) {
  const result = await esbuild.build({ ...options, absWorkingDir: ROOT, logLevel: 'warning' });
  if (result.warnings.length) throw new Error(`esbuild: ${result.warnings.length} warning(s), see above`);
  return result;
}

/** Bundle the TypeScript module `entry` (relative to ROOT) in memory and import it. For tests and the site build. */
export async function importTs(entry, options = { bundle: true, format: 'esm', platform: 'node' }) {
  const { outputFiles } = await bundle({ ...options, entryPoints: [entry], write: false });
  return import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].contents).toString('base64')}`);
}

/**
 * dist/pages/: index.html, main-<hash>.js (the page, bubble-web, the CLI and the story in one bundle),
 * style-<hash>.css. The hashed names keep a browser from mixing a new page with stale cached files.
 */
export async function buildSite(out = path.join(ROOT, 'dist', 'pages')) {
  const { parseStory } = await importTs('src/site/build/story.mts');
  const story = parseStory(fs.readFileSync(path.join(ROOT, 'demo', 'story.md'), 'utf8'));

  fs.rmSync(out, { recursive: true, force: true });
  const { metafile } = await bundle({
    ...browserOptions,
    entryPoints: { main: 'src/site/terminal/main.mts', style: 'src/site/terminal/style.css' },
    entryNames: '[name]-[hash]',
    outdir: out,
    platform: 'browser',
    define: { STORY: JSON.stringify(story) },
    metafile: true,
  });

  const built = (entry) => path.basename(Object.keys(metafile.outputs).find((f) => metafile.outputs[f].entryPoint === entry));
  const page = fs.readFileSync(path.join(ROOT, 'src', 'site', 'terminal', 'index.html'), 'utf8');
  const html = [
    ['href="style.css"', `href="${built('src/site/terminal/style.css')}"`],
    ['src="main.js"', `src="${built('src/site/terminal/main.mts')}"`],
  ].reduce((s, [from, to]) => {
    if (!s.includes(from)) throw new Error(`src/site/terminal/index.html: ${from} moved; update build.mjs`);
    return s.replace(from, to);
  }, page);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
}

// Run as a script (not when a test imports it).

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const what = process.argv[2] ?? 'cli';
  if (what === 'cli') {
    for (const build of CLI_BUILDS) buildCli(build);
    console.log(`built ${CLI_BUILDS.map((b) => `${b.out}/`).join(', ')}`);
  } else if (what === 'site') {
    checkSite();
    await buildSite();
    console.log('built dist/pages/');
  } else if (what === 'check') {
    checkSite();
  } else {
    console.error('usage: node build.mjs [cli|site|check]');
    process.exitCode = 2;
  }
}
