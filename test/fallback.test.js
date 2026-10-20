'use strict';
// skills/bubble/fallback.md teaches agents without Node to edit tracks by hand; keep it in step with the store code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const T = require('../skills/bubble/scripts/lib');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fallback = read('skills/bubble/fallback.md');
const model = read('src/lib/model.ts');

/** Field names of `interface <name> { ... }` in src/lib/model.ts. */
function fields(name) {
  const body = new RegExp(`interface ${name} \\{([^}]*)\\}`).exec(model);
  assert.ok(body, `no interface ${name} in model.ts`);
  return [...body[1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
}

/** Words that no code span in fallback.md starts with (`word` or `word <args>`). */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const missing = (words) => words.filter((w) => !new RegExp(`\`${escape(w)}[\` ]`).test(fallback));

test('fallback.md names every Track and Bubble field', () => {
  assert.deepStrictEqual(missing([...fields('Track'), ...fields('Bubble')]), []);
});

test('fallback.md names every bubble state and fog type', () => {
  const states = /type BubbleState = ([^;]+);/.exec(model)[1].match(/'(\w+)'/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(missing([...states, ...T.TYPES, 'kk', 'ku', 'uk', 'uu']), []);
});

test('fallback.md covers every CLI command, by hand or as CLI-only', () => {
  const src = read('src/lib/cli/bubbles.ts') + read('src/lib/cli/tracks.ts');
  const aliases = ['status', 'rm', 'mv'];
  const commands = [...src.matchAll(/case '(\w+)':/g)].map((m) => m[1]).filter((c) => !aliases.includes(c));
  assert.ok(commands.length > 15, 'found too few commands — did the CLI move?');
  assert.deepStrictEqual(missing(commands), []);
});

test('fallback.md layout matches the store', () => {
  assert.deepStrictEqual(missing([T.TRACK_DIR + '/', 'current', T.DEFAULT_NAME, 'track.json', '???']), []);
  const empty = { bubbles: [] };
  T.add(empty, undefined, { fog: true });
  assert.deepStrictEqual(empty.bubbles[0], { title: '???', state: 'fog', id: 1 });
  T.setHandoff(empty, 'x');
  assert.match(empty.handoff.at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
  assert.ok(fallback.includes('`YYYY-MM-DD HH:MM UTC`'));
});

test('fallback.md example is a valid track', () => {
  const json = /```json\n([\s\S]*?)```/.exec(fallback);
  assert.ok(json, 'no ```json example in fallback.md');
  const track = JSON.parse(json[1]);
  assert.ok(Array.isArray(track.bubbles));
  const ids = track.bubbles.map((b) => b.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate ids');
  assert.ok(ids.every((id) => id < track.nextId), 'nextId must be above every id');
  for (const b of track.bubbles) assert.ok(['todo', 'fog', 'done'].includes(b.state), `stored state "${b.state}"`);
  assert.strictEqual(T.render(track, { ascii: false }), 'Fix generation   S ●──❓──○ F   Repro ‹ ❓ needs you › Patch');
});

test('SKILL.md and the AGENTS.md adapter point to fallback.md', () => {
  assert.match(read('skills/bubble/SKILL.md'), /exit 127.*`fallback\.md`/);
  assert.match(read('adapters/agents-md.md'), /exit 127.*`fallback\.md`/);
});
