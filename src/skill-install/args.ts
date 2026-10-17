// Installer arguments: which agents to wire up, where, and whether to write anything.

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

export function parseArgs(argv: string[]): InstallOpts {
  const opts: InstallOpts = { agents: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') opts.project = argv[++i];
    else if (a === '--user') opts.user = true;
    else if (a === '--apply-statusline') opts.applyStatusline = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === 'all') opts.agents.push(...AGENTS);
    else if (isAgent(a)) opts.agents.push(a);
    else throw new Error(`unknown argument "${a}"`);
  }
  opts.agents = [...new Set(opts.agents)];
  return opts;
}
