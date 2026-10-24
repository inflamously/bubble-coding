// What research found for a bubble: guides or tips with their source, noted while running the research workflow.
import { resolve } from '../model.js';
/** Note a finding on a bubble; "M -" drops finding M, "-" drops them all. */
export function finding(track, addr, text) {
    const b = track.bubbles[resolve(track, addr)];
    if (!text)
        throw new Error('finding needs text (or M - to drop finding M, - to drop all)');
    const findings = b.findings || [];
    if (text === '-') {
        delete b.findings;
        if (!findings.length)
            return `no findings on "${b.title}" to drop`;
        return `dropped ${findings.length} finding${findings.length === 1 ? '' : 's'} on "${b.title}"`;
    }
    const drop = /^(\d+) -$/.exec(text);
    if (drop) {
        const n = Number(drop[1]);
        if (!findings[n - 1])
            throw new Error(`no finding ${n} on "${b.title}"`);
        const [old] = findings.splice(n - 1, 1);
        if (findings.length)
            b.findings = findings;
        else
            delete b.findings;
        return `dropped finding ${n} on "${b.title}": ${old}`;
    }
    b.findings = [...findings, text];
    return `finding ${b.findings.length} on "${b.title}": ${text}`;
}
