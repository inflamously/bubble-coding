// The hooks and the installer run committed JS, so it must be exactly what src/*.ts builds to.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
// Each tsconfig and the committed folder its build must match.
const BUILDS = [
  { config: 'tsconfig.json', out: 'skills/bubble/scripts' },
  { config: 'tsconfig.skill-install.json', out: 'skill-install' },
];

/** Every file under `dir`, as sorted forward-slash relative paths. */
const filesIn = (dir) =>
  fs.readdirSync(dir, { recursive: true })
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .map((f) => f.split(path.sep).join('/'))
    .sort();

for (const { config, out: committedDir } of BUILDS) {
  test(`committed ${committedDir}/ matches a fresh build of ${config} (run: npm run build)`, () => {
    let tsc;
    try {
      tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
    } catch {
      assert.fail('typescript is not installed — run: npm install');
    }
    const committed = path.join(ROOT, committedDir);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-build-'));
    try {
      const r = spawnSync(process.execPath, [tsc, '-p', path.join(ROOT, config), '--outDir', out], { encoding: 'utf8' });
      assert.strictEqual(r.status, 0, `tsc failed:\n${r.stdout}${r.stderr}`);
      assert.deepStrictEqual(filesIn(committed), filesIn(out), `${committedDir}/ has files ${config} does not build (or misses some)`);
      for (const f of filesIn(out)) {
        const built = fs.readFileSync(path.join(out, f), 'utf8');
        assert.ok(built === fs.readFileSync(path.join(committed, f), 'utf8'), `${committedDir}/${f} is out of date with src/`);
      }
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
}
