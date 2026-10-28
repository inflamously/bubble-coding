import test from 'node:test';
import assert from 'node:assert';
import * as T from '../skills/bubble/scripts/lib/index.js';

const sample = () => ({
  title: 'Fix generation',
  bubbles: [
    { title: 'Repro', state: 'done' },
    { title: '???', state: 'fog' },
    { title: 'Patch', state: 'todo' },
  ],
});

test('active bubble is the first one not done', () => {
  assert.strictEqual(T.activeIndex(sample()), 1);
  assert.strictEqual(T.activeBubble(sample()).state, 'fog');
  assert.strictEqual(T.activeBubble({ title: 'E', bubbles: [{ title: 'A', state: 'done' }] }), null);
});

test('render unicode + ascii', () => {
  assert.strictEqual(T.render(sample(), { ascii: false }), 'Fix generation   S ●──❓──○ F   Repro ‹ ❓ needs you › Patch');
  assert.strictEqual(T.render(sample(), { ascii: true }), 'Fix generation   S *--?--o F   Repro < ? needs you > Patch');
});

test('render with active todo, and all done', () => {
  const t = { title: 'P', bubbles: [{ title: 'A', state: 'done' }, { title: 'B', state: 'todo' }] };
  assert.strictEqual(T.render(t, { ascii: false }), 'P   S ●──◐ F   A ‹ ◐ B');
  T.done(t);
  assert.strictEqual(T.render(t, { ascii: false }), 'P   S ●──● F   all done');
  assert.strictEqual(T.render({ title: 'E', bubbles: [] }, { ascii: true }), 'E   S F   empty');
});

test('render closed: nothing active, a lock instead of prev ‹ active › next', () => {
  const at = '2026-10-16T00:00:00.000Z';
  const t = { title: 'P', closed: { at }, bubbles: [{ title: 'A', state: 'done' }, { title: 'B', state: 'todo' }, { title: '???', state: 'fog' }] };
  assert.strictEqual(T.render(t, { ascii: false }), 'P   S ●──○──❓ F   🔒 closed');
  assert.strictEqual(T.render(t, { ascii: true }), 'P   S *--o--? F   # closed');
  assert.strictEqual(T.render({ title: 'E', closed: { at }, bubbles: [] }, { ascii: false }), 'E   S F   🔒 closed');
});

test('done refuses fog; fill lifts it', () => {
  const t = sample();
  assert.throws(() => T.done(t), /fog/);
  T.setType(t, undefined, 'unknown-known');
  T.fill(t, undefined, 'Check loader');
  assert.strictEqual(T.activeBubble(t).title, 'Check loader');
  assert.strictEqual(T.activeBubble(t).type, 'unknown-known');
  assert.match(T.done(t), /"Check loader"/);
  assert.strictEqual(T.activeBubble(t).title, 'Patch');
  T.done(t);
  assert.throws(() => T.done(t), /already done/);
});

test('addressing: N, active, errors', () => {
  const t = sample();
  T.fog(t, '3', 'known-unknown');
  assert.strictEqual(t.bubbles[2].state, 'fog');
  assert.throws(() => T.fog(t, '9'), /no bubble/);
  assert.throws(() => T.fog(t, '1.1'), /bad bubble range/);
  assert.throws(() => T.fog(t, 'x'), /bad bubble range/);
  assert.throws(() => T.rename(t, 'x', 'y'), /bad bubble address/);
  assert.throws(() => T.setType(t, '1', 'maybe'), /unknown fog type/);
  T.fill(t, '2', 'Planned');
  assert.strictEqual(t.bubbles[1].state, 'todo');
});

test('add at end, at position, fog, errors', () => {
  const t = { title: 'P', bubbles: [] };
  T.add(t, 'A');
  T.add(t, undefined, { fog: true });
  T.add(t, 'Zero', { at: 1 });
  assert.deepStrictEqual(t.bubbles.map((b) => b.title), ['Zero', 'A', '???']);
  assert.throws(() => T.add(t, ''), /needs a title/);
  assert.throws(() => T.add(t, 'x', { at: 9 }), /bad position/);
});

const five = () => ({ title: 'P', bubbles: ['A', 'B', 'C', 'D', 'E'].map((title) => ({ title, state: 'todo' })) });
const titles = (t) => t.bubbles.map((b) => b.title).join('');

test('move: single bubble and block, position in the resulting track', () => {
  const t = five();
  T.move(t, '2', '5');
  assert.strictEqual(titles(t), 'ACDEB');
  T.move(t, '1:2', '3');
  assert.strictEqual(titles(t), 'DEACB');
  assert.throws(() => T.move(t, '1', '9'), /bad position/);
  assert.strictEqual(titles(t), 'DEACB', 'failed move leaves the track untouched');
  assert.throws(() => T.move(t, '9', '1'), /no bubble/);
});

test('moveTo: block goes to the end of the target with new ids; linked bubbles stay', () => {
  const t = five();
  t.bubbles[1].hint = 'b note';
  t.bubbles[2].state = 'done';
  const target = { title: 'O', bubbles: [{ title: 'X', state: 'todo', id: 1 }], nextId: 2 };
  assert.strictEqual(T.moveTo(t, '2:3', target, 'other'), 'moved "B", "C" to track "other"');
  assert.strictEqual(titles(t), 'ADE');
  assert.deepStrictEqual(target.bubbles.slice(1), [
    { title: 'B', state: 'todo', id: 2, hint: 'b note' },
    { title: 'C', state: 'done', id: 3 },
  ]);
  assert.strictEqual(target.nextId, 4);
  t.bubbles[1].sides = ['side.json'];
  assert.throws(() => T.moveTo(t, '1:2', target, 'other'), /"D" has a fork or side track/);
  assert.strictEqual(titles(t), 'ADE', 'refused move leaves both tracks untouched');
  assert.strictEqual(target.bubbles.length, 3);
});

test('remove: single and range', () => {
  const t = five();
  T.remove(t, '2');
  T.remove(t, '2:3');
  assert.strictEqual(titles(t), 'AE');
  assert.throws(() => T.remove(t, '3:2'), /bad bubble range/);
});

test('fog: ranges, type shorthands, done bubbles need force', () => {
  const t = five();
  T.fog(t, '2:3', 'ku');
  assert.deepStrictEqual(t.bubbles.slice(1, 3).map((b) => [b.state, b.type]), [['fog', 'known-unknown'], ['fog', 'known-unknown']]);
  T.done(t);
  assert.throws(() => T.fog(t, '1'), /--force/);
  T.fog(t, '1', undefined, { force: true });
  assert.strictEqual(t.bubbles[0].state, 'fog');
  T.setType(t, '1', 'uu');
  assert.strictEqual(t.bubbles[0].type, 'unknown-unknown');
});

test('fill is fog-only; rename is for planned bubbles', () => {
  const t = five();
  assert.throws(() => T.fill(t, '1', 'x'), /isn't fog/);
  T.rename(t, '1', 'Alpha');
  assert.strictEqual(t.bubbles[0].title, 'Alpha');
  T.fog(t, '2');
  assert.throws(() => T.rename(t, '2', 'x'), /plan it with fill/);
  assert.throws(() => T.fill(t, '2', ''), /needs a title/);
});

test('hint: set, list shows it, clear', () => {
  const t = five();
  T.hint(t, '2', 'keep it soft');
  assert.match(T.list(t, { ascii: true }), /B\n\s+↳ keep it soft/);
  T.hint(t, '2', '-');
  assert.strictEqual(t.bubbles[1].hint, undefined);
});

test('render: prev ‹ active › next with labels shortened at word boundaries', () => {
  const t = {
    title: 'P',
    bubbles: [
      { title: 'Remove nesting from the CLI and the library', state: 'done' },
      { title: 'Where am I', state: 'todo' },
      { title: 'Supercalifragilisticexpialidocious', state: 'todo' },
    ],
  };
  assert.strictEqual(T.render(t, { ascii: false }), 'P   S ●──◐──○ F   Remove nesting from… ‹ ◐ Where am I › Supercalifragilisti…');
  assert.strictEqual(T.shorten('Where am I', T.SYMBOLS.ascii), 'Where am I');
  assert.strictEqual(T.shorten('Remove nesting from the CLI', T.SYMBOLS.ascii), 'Remove nesting...');
  t.bubbles[1].state = 'done';
  assert.strictEqual(T.render(t, { ascii: false }), 'P   S ●──●──◐ F   Where am I ‹ ◐ Supercalifragilisti…');
});

test('handoff: save with timestamp, clear, needs a note', () => {
  const t = five();
  T.setHandoff(t, 'parser done, tests missing', new Date('2026-10-15T20:41:00Z'));
  assert.deepStrictEqual(t.handoff, { note: 'parser done, tests missing', at: '2026-10-15 20:41 UTC' });
  T.setHandoff(t, '-');
  assert.strictEqual(t.handoff, undefined);
  assert.throws(() => T.setHandoff(t, ''), /needs a note/);
});

test('near misses: prefix or edit distance under a length-based cutoff, closest first', () => {
  assert.strictEqual(T.editDistance('flow-anlysis', 'flow-analysis'), 1);
  assert.strictEqual(T.editDistance('', 'abc'), 3);
  assert.deepStrictEqual([3, 4, 5, 12].map((n) => T.nearCutoff('x'.repeat(n))), [0, 1, 2, 2]);
  assert.ok(T.isNearMiss('flow', 'flow-analysis')); // prefix
  assert.ok(T.isNearMiss('tesr', 'test')); // 4 characters: 1 edit
  assert.ok(!T.isNearMiss('tset', 'test')); // a swap is 2 edits
  assert.ok(T.isNearMiss('auth-ssso', 'auth-sso'));
  assert.ok(!T.isNearMiss('ui', 'ux'));
  assert.ok(!T.isNearMiss('same', 'SAME')); // the same name isn't a miss
  assert.deepStrictEqual(T.nearMisses('flow', ['flow-analysis', 'flow-chart', 'other']), ['flow-chart', 'flow-analysis']);
});
