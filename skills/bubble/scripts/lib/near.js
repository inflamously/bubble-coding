// Near-miss track names: which existing tracks a new name probably meant, so `switch flow` doesn't
// quietly create a track next to `flow-analysis`. Like git's "did you mean": a prefix, or a small edit distance.
// Comparing names.
/** Levenshtein distance: the fewest one-character inserts, deletes or substitutions from `a` to `b`. */
export function editDistance(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = row;
    }
    return prev[b.length];
}
/** How many edits still count as a slip: none up to 3 characters (`ui` vs `ux`), 1 at 4, 2 from 5 on. */
export const nearCutoff = (name) => Math.min(2, Math.max(0, name.length - 3));
/** The name among `names` that is `name` but for case, the exact one first; undefined if none. Track names ignore case,
 *  so `Flow-Analysis` and `flow-analysis` never live side by side (they'd be one file on macOS and Windows). */
export function sameName(name, names) {
    return names.includes(name) ? name : names.find((other) => other.toLowerCase() === name.toLowerCase());
}
/** Whether `name` looks like a slip for the existing `other`: the start of it, or within the cutoff. Ignores case. */
export function isNearMiss(name, other) {
    const a = name.toLowerCase();
    const b = other.toLowerCase();
    return a !== b && (b.startsWith(a) || editDistance(a, b) <= nearCutoff(a));
}
/** The names among `names` that `name` probably meant, closest first. */
export function nearMisses(name, names) {
    const a = name.toLowerCase();
    return names
        .filter((other) => isNearMiss(name, other))
        .sort((x, y) => editDistance(a, x.toLowerCase()) - editDistance(a, y.toLowerCase()) || x.localeCompare(y));
}
