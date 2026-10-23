// Installer arguments: which agents to wire up, where, and whether to write anything.

import { parseArgs as parseFlags } from 'node:util';

export const AGENTS = ['claude', 'codex', 'gemini', 'agents-md'] as const;
export type Agent = (typeof AGENTS)[number];

export interface InstallOpts {
  agents: Agent[];
  project?: string;
  user?: boolean;
  applyStatusline?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

export const HELP = `bubble-tracks installer

  node install.js <agent...> [--project <dir> | --user] [--apply-statusline] [--dry-run]

  agents: claude | codex | gemini | agents-md | all
  --project <dir>     install into a repo (default: current directory)
  --user              install user-wide (~/.agents, ~/.codex, ~/.gemini)
  --apply-statusline  (claude) write the statusLine into ~/.claude/settings.json
  --dry-run           print what would change, write nothing`;

const isAgent = (a: string): a is Agent => (AGENTS as readonly string[]).includes(a);

const OPTIONS = {
  project: { type: 'string' },
  user: { type: 'boolean' },
  'apply-statusline': { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const;

/** Node's parse errors are long and speak its own syntax; keep the installer's short ones. */
function flagError(err: Error & { code?: string }): Error {
  const name = /'(-[^' ]+)/.exec(err.message)?.[1];
  if (err.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') return new Error(`unknown argument "${name}"`);
  if (err.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') return new Error(`${name} needs a value`);
  return err;
}

export function parseArgs(argv: string[]): InstallOpts {
  let parsed;
  try {
    parsed = parseFlags({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (err) {
    throw flagError(err as Error);
  }
  const { values, positionals } = parsed;
  const agents = positionals.flatMap((a) => {
    if (a === 'all') return AGENTS;
    if (isAgent(a)) return a;
    throw new Error(`unknown argument "${a}"`);
  });
  return {
    agents: [...new Set(agents)],
    project: values.project,
    user: values.user,
    applyStatusline: values['apply-statusline'],
    dryRun: values['dry-run'],
    help: values.help,
  };
}
