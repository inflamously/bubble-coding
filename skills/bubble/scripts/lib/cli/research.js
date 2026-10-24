// The research command: prints the research workflow and one bubble's whole context (the track's goal and
// guards, the bubble's hint, fog trail and findings, its neighbours) for the agent, or its subagents, to run
// once. It changes nothing itself; what the research finds goes on the bubble with finding N <text>.
import * as lib from '../index.js';
import { isAddr } from './args.js';
import { currentTrack } from './bubbles.js';
import { printGuards } from './print.js';
/** The workflow for bubble n: extend the human's intent, never overrule it. */
const WORKFLOW = (n) => [
    `  1. Scope: bubble #${n} only, inside the goal and guards below. Its title, hint and fog stay the human's.`,
    '  2. Questions: name the 2–3 things this bubble leaves open, the human\'s words first. If you can start',
    '     subagents, give each one question and the context below, not the whole chat.',
    '  3. Look: the codebase, its docs, the web. Bring back at least 2–3 guides or tips, each saying what it',
    '     means for this bubble and where it comes from.',
    `  4. Note each one: finding ${n} <tip — source>. Findings stay on the bubble, for whoever builds it.`,
    `  5. Propose, don't apply: a missing step of this bubble → insert at ${n + 1} <title>; another direction →`,
    '     fork or diverge; a finding that goes against what the human asked → ask them. On fog, findings help',
    '     the human classify and fill it; never fill it yourself.',
];
const STOP = '⏸ stop — show the findings and proposals to the human and wait. Research runs again only when the human asks.';
/** Print bubble i's context: the goal and guards that bound it, the bubble itself, and its neighbours. */
function printContext({ name, track }, i, opts) {
    const b = track.bubbles[i];
    const title = track.title ? ` — ${track.title}` : '';
    const active = i === lib.activeIndex(track) ? ', active' : '';
    console.log(`── context: bubble #${i + 1} on track "${name}"${title} ──`);
    if (track.goal)
        console.log(`${lib.symbolsFor(opts).goal} goal: ${track.goal}`);
    printGuards(track, opts);
    console.log(`#${i + 1} "${b.title}" (${b.state}${active}${b.type ? `, ${b.type}` : ''})`);
    if (b.why)
        console.log(`why: ${b.why}`);
    if (b.answer)
        console.log(`human: ${b.answer}`);
    if (b.hint)
        console.log(`↳ ${b.hint}`);
    (b.findings || []).forEach((f, n) => console.log(`found ${n + 1}: ${f}`));
    const prev = track.bubbles[i - 1];
    const next = track.bubbles[i + 1];
    if (prev)
        console.log(`before: #${i} "${prev.title}" (${prev.state})`);
    if (next)
        console.log(`after: #${i + 2} "${next.title}" (${next.state})`);
}
/** Run the research command; returns an exit code, or undefined if `cmd` isn't it. */
export function runResearchCommand(cmd, args, { dir, renderOpts }) {
    if (cmd !== 'research')
        return undefined;
    const found = currentTrack(dir);
    if (found.track.closed)
        throw new Error(`track "${found.name}" is closed (read-only) — its bubbles can't take findings`);
    const i = lib.resolve(found.track, isAddr(args[0]) ? args.shift() : undefined);
    console.log(`research #${i + 1} "${found.track.bubbles[i].title}" — run this once; extend the human's intent, never overrule it`);
    if (args.length)
        console.log(`the human adds: ${args.join(' ')}`);
    console.log('');
    for (const line of WORKFLOW(i + 1))
        console.log(line);
    console.log('');
    printContext(found, i, renderOpts);
    console.log('');
    console.log(STOP);
    return 0;
}
