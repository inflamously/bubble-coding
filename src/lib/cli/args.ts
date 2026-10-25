// CLI language: help text and argument parsing. A leading "bubble" word is optional,
// and a whole phrase can be passed as one quoted argument: node bubble.js "move 2 to 5".

import { parseArgs as parseFlags } from 'node:util';
import { TYPES } from '../model.js';
import type { RenderOpts } from '../render/index.js';

export type CliOpts = ReturnType<typeof flags>['values'];

/** What every command gets: the repo dir, the parsed options, and how to render. */
export interface Ctx {
  dir: string;
  opts: CliOpts;
  renderOpts: RenderOpts;
}

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
} as const;

const flags = (args: string[]) => parseFlags({ args, options: OPTIONS, allowPositionals: true });

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
  add <title>   | add ? [why]   append a todo (or fog) bubble; a fog says in one line why it's unclear
  insert at N <title> | insert at N ? [why]
                                insert a todo (or fog) bubble at position N
  remove N | N:M                delete a bubble or a range
  move N to M | move N:M to M   move a bubble or block so it starts at M
  move N | N:M --to <track>     move a bubble or block to the end of another track
  rename N <title>              retitle a planned bubble
  title <text>                  rename the track itself
  goal <text>                   set the track's goal once: the one end result every bubble serves
                                (a new goal is a new track; --force rewords it, after the human confirms)
  guard <text> | guard N <text> add a guard (what not to do; read before acting), or rewrite guard N
  guard drop N | guard drop --all
                                drop guard N, or all of them (--all needs --force, after the human confirms)
  guard show                    list the guards (also printed on switch and after every guard change)
  handoff <note> | handoff -    save (or clear) the note a fresh chat reads to resume
  hint N <text> | hint N -      attach (or clear) a note for that bubble
  fog [N | N:M] [TYPE]          turn bubbles into fog (done ones need --force)
  why [N] <text> | why [N] -    say (or clear) why a fog bubble is unclear: not what it is
  type [N] <TYPE>               classify a fog bubble
  answer [N] <text> | answer [N] -
                                keep (or clear) the human's own words on a fog that stays fog
  fill [N] <title>              the human's content for a fog bubble: fog -> todo
  done                          pop the active bubble, then ⏸ stop

  research [N] [focus]          print the research workflow and bubble N's context, to run once
                                (subagents welcome); it changes nothing itself
  finding N <text> | finding N M - | finding N -
                                note what research found for bubble N (a guide or tip, with its source),
                                drop finding M, or drop them all

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
function flagError(err: Error & { code?: string }): Error {
  const name = /'(-[^' ]+)/.exec(err.message)?.[1];
  if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return new Error(`unknown option "${name}" — try: help (text starting with - goes after --)`);
  if (err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') return new Error(name === '--to' ? '--to needs a track name' : `${name} needs a value`);
  return err;
}

export function parseArgs(argv: string[]): { cmd: string | undefined; args: string[]; opts: CliOpts } {
  let parsed;
  try {
    parsed = flags(argv);
  } catch (err) {
    throw flagError(err as Error);
  }
  const { values: opts, positionals } = parsed;
  // A whole phrase passed as one argument: "move 2 to 5".
  const pos = positionals.length === 1 ? positionals[0].trim().split(/\s+/) : positionals;
  if (pos[0] === 'bubble') pos.shift();
  return { cmd: pos[0], args: pos.slice(1), opts };
}

export const isAddr = (s: unknown): s is string => typeof s === 'string' && /^\d+$/.test(s);
export const isRange = (s: unknown): s is string => typeof s === 'string' && /^\d+(:\d+)?$/.test(s);

export function needAddr(args: string[], usage: string): string {
  if (!isAddr(args[0])) throw new Error(`usage: ${usage}`);
  return args.shift()!;
}
