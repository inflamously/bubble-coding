'use strict';
// The plugin is published from three manifests; keep their shared fields in step.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

test('package.json, plugin.json and marketplace.json agree', () => {
  const pkg = read('package.json');
  const plugin = read('.claude-plugin/plugin.json');
  const market = read('.claude-plugin/marketplace.json');
  const entry = market.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, `marketplace.json lists no plugin named "${plugin.name}"`);
  assert.strictEqual(plugin.version, pkg.version, 'plugin.json version != package.json version');
  assert.strictEqual(entry.version, undefined, 'set the version in plugin.json only (it wins over marketplace.json)');
  assert.strictEqual(plugin.license, pkg.license);
  assert.strictEqual(entry.license, pkg.license);
  assert.strictEqual(entry.repository, plugin.repository);
  assert.ok(fs.existsSync(path.join(ROOT, 'LICENSE')), 'LICENSE file missing');
});
