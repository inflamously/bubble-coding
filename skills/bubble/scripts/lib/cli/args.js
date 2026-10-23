// CLI language: help text and argument parsing. A leading "bubble" word is optional,
// and a whole phrase can be passed as one quoted argument: node bubble.js "move 2 to 5".
import { parseArgs as parseFlags } from 'node:util';
import { TYPES } from '../model.js';
const OPTIONS = {
    ascii: { type: 'boolean' },
    fog: { type: 'boolean' },
    force: { type: 'boolean' },
    closed: { type: 'boolean' },
    all: { type: 'boolean' },
    dir: { type: 'string' },
    at: { type: 'string' },
    to: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
};
const flags = (args) => parseFlags({ args, options: OPTIONS, allowPositionals: true });
export const HELP = `bubble-tracks — the bubble language

  switch [name] [title]         resume track <name>, or create it; no name = the current (else default) track
  create <name> [title]         create a new track (refuses if it exists) and make it current
  tracks [--closed | --all]     list the tracks, current marked →; closed ones are hidden unless
                                --closed (only closed) or --all (everything)
  close <name> --force          finish and archive a track: read-only for good, no reopen. Also closes
                                all its forks (side tracks stay open) and pops its parent bubble
  delete <name> --force         delete a track (not the current one)
  fork [N] <name>               build on bubble N in a child track <name>; the bubble waits for it. Makes it current
  diverge [N] <name> [title]    go a different direction from bubble N in a side track <name> (titled after
                                the bubble unless given); nothing waits. Makes it current
  init <title>                  create the default track (.bubble-tracks/track.json)

  show                          render the current track + list its bubbles
  add <title>   | add ?         append a todo (or fog) bubble
  insert at N <title> | insert at N ?
                                insert a todo (or fog) bubble at position N
  remove N | N:M                delete a bubble or a range
  move N to M | move N:M to M   move a bubble or block so it starts at M
  move N | N:M --to <track>     move a bubble or block to the end of another track
  rename N <title>              retitle a planned bubble
  title <text>                  rename the track itself
  goal <text> | goal -          set (or clear) the track's goal: the one end result every bubble serves
  guard <text> | guard N - | guard -
                                add a guard (what not to do; checked before done), drop guard N, or drop all
  guard show                    list the guards (also printed on switch and after every guard change)
  handoff <note> | handoff -    save (or clear) the note a fresh chat reads to resume
  hint N <text> | hint N -      attach (or clear) a note for that bubble
  fog [N | N:M] [TYPE]          turn bubbles into fog (done ones need --force)
  type [N] <TYPE>               classify a fog bubble
  fill [N] <title>              the human's content for a fog bubble: fog -> todo
  done                          pop the active bubble, then ⏸ stop

  abilities                     list the abilities: name, type, project or user, description
  bubble:<ability> [text]       print an ability's workflow to run once on the active bubble or track
                                (<name>.md in .bubble-tracks/abilities/, then ~/.bubble-tracks/abilities/)

  N: position on the track (omitted = the active bubble). N:M: N through M, inclusive.
  TYPE: ${TYPES.join(' | ')}  (or kk | ku | uk | uu)
  Options: --dir <repo> (default: cwd)   --ascii (or BUBBLES_ASCII=1)   --force
           --to <track> (or --to=<track>): add, insert and hint write into that track; the current track stays current
           a word that starts with - is an option; put text like that after --:  hint 2 -- -v means verbose
           color on a terminal; BUBBLES_COLOR=1/0 forces it, NO_COLOR disables it
           add <title> --at N  and  add --fog [title]  still work.
  Exit codes: 0 ok, 1 error, 3 (show only) active bubble is fog — needs the human`;
/** Node's parse errors are long and speak its own syntax; say them in the bubble language. */
function flagError(err) {
    const name = /'(-[^' ]+)/.exec(err.message)?.[1];
    if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION')
        return new Error(`unknown option "${name}" — try: help (text starting with - goes after --)`);
    if (err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE')
        return new Error(name === '--to' ? '--to needs a track name' : `${name} needs a value`);
    return err;
}
export function parseArgs(argv) {
    let parsed;
    try {
        parsed = flags(argv);
    }
    catch (err) {
        throw flagError(err);
    }
    const { values: opts, positionals } = parsed;
    // A whole phrase passed as one argument: "move 2 to 5".
    const pos = positionals.length === 1 ? positionals[0].trim().split(/\s+/) : positionals;
    if (pos[0] === 'bubble')
        pos.shift();
    return { cmd: pos[0], args: pos.slice(1), opts };
}
export const isAddr = (s) => typeof s === 'string' && /^\d+$/.test(s);
export const isRange = (s) => typeof s === 'string' && /^\d+(:\d+)?$/.test(s);
export function needAddr(args, usage) {
    if (!isAddr(args[0]))
        throw new Error(`usage: ${usage}`);
    return args.shift();
}
