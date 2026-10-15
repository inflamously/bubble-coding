'use strict';
// The hooks run the committed JS in skills/bubble/scripts, so it must be exactly what src/*.ts builds to.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPTS = path.join(ROOT, 'skills', 'bubble', 'scripts');

/** Every file under `dir`, as sorted forward-slash relative paths. */
const filesIn = (dir) =>
  fs.readdirSync(dir, { recursive: true })
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .map((f) => f.split(path.sep).join('/'))
    .sort();

test('committed scripts match a fresh build of src/ (run: npm run build)', () => {
  let tsc;
  try {
    tsc = path.join(path.dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');
  } catch {
    assert.fail('typescript is not installed — run: npm install');
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bubbles-build-'));
  try {
    const r = spawnSync(process.execPath, [tsc, '-p', ROOT, '--outDir', out], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `tsc failed:\n${r.stdout}${r.stderr}`);
    assert.deepStrictEqual(filesIn(SCRIPTS), filesIn(out), 'scripts/ has files src/ does not build (or misses some)');
    for (const f of filesIn(out)) {
      const built = fs.readFileSync(path.join(out, f), 'utf8');
      const committed = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
      assert.ok(built === committed, `skills/bubble/scripts/${f} is out of date with src/`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
