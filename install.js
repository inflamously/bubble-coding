'use strict';
// Bubble Planner installer — wires the portable skill into each agent.
// Usage: node install.js <claude|codex|gemini|agents-md|all> [--project <dir> | --user] [--apply-statusline] [--dry-run]

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = __dirname;
const SKILL_SRC = path.join(REPO, 'skills', 'bubble');
const ADAPTERS = path.join(REPO, 'adapters');
const AGENTS = ['claude', 'codex', 'gemini', 'agents-md'];

const HELP = `Bubble Planner installer

  node install.js <agent...> [--project <dir> | --user] [--apply-statusline] [--dry-run]

  agents: claude | codex | gemini | agents-md | all
  --project <dir>     install into a repo (default: current directory)
  --user              install user-wide (~/.agents, ~/.codex, ~/.gemini)
  --apply-statusline  (claude) write the statusLine into ~/.claude/settings.json
  --dry-run           print what would change, write nothing`;

// ---------- args ----------

function parseArgs(argv) {
  const opts = { agents: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project') opts.project = argv[++i];
    else if (a === '--user') opts.user = true;
    else if (a === '--apply-statusline') opts.applyStatusline = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a === 'all') opts.agents.push(...AGENTS);
    else if (AGENTS.includes(a)) opts.agents.push(a);
    else throw new Error(`unknown argument "${a}"`);
  }
  opts.agents = [...new Set(opts.agents)];
  return opts;
}

// ---------- helpers ----------

/** Forward slashes work for node on Windows too, and avoid escaping trouble in JSON/TOML/shell. */
const slash = (p) => p.split(path.sep).join('/');
const nodeCmd = (script) => `node "${slash(script)}"`;

let DRY = false;
const log = (msg) => console.log(msg);

function writeFile(file, content) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old === content) return log(`  = unchanged  ${file}`);
  if (DRY) return log(`  ~ would write ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (old !== null) fs.writeFileSync(`${file}.bak`, old, 'utf8');
  fs.writeFileSync(file, content, 'utf8');
  log(`  ${old === null ? '+ created ' : '~ updated '} ${file}${old !== null ? ' (backup: .bak)' : ''}`);
}

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not plain JSON (${err.message}) — add the entry by hand`);
  }
}

const writeJson = (file, obj) => writeFile(file, JSON.stringify(obj, null, 2) + '\n');

/** Replace any previous bubble entry for `event`, then append ours. */
function upsertHook(settings, event, entry) {
  settings.hooks = settings.hooks || {};
  const list = (settings.hooks[event] || []).filter(
    (group) => !(group.hooks || []).some((h) => String(h.command || '').includes('fog-gate.js'))
  );
  list.push(entry);
  settings.hooks[event] = list;
  return settings;
}

/** Copy the self-contained skill folder (once per run); returns its installed dir. */
const installed = new Set();
function installSkill(base) {
  const dest = path.join(base, '.agents', 'skills', 'bubble');
  if (installed.has(dest) || path.resolve(dest) === path.resolve(SKILL_SRC)) return dest;
  installed.add(dest);
  if (DRY) {
    log(`  ~ would copy skill -> ${dest}`);
    return dest;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(SKILL_SRC, dest, { recursive: true });
  log(`  + skill      ${dest}`);
  return dest;
}

const scriptsOf = (skillDir) => ({
  cli: path.join(skillDir, 'scripts', 'bubble.js'),
  gate: path.join(skillDir, 'scripts', 'fog-gate.js'),
  statusline: path.join(skillDir, 'scripts', 'statusline.js'),
  skillMd: path.join(skillDir, 'SKILL.md'),
});

// ---------- adapters ----------

function claude(ctx) {
  log('\n[claude] Claude Code plugin');
  const statusline = scriptsOf(SKILL_SRC).statusline;
  const statusLine = { type: 'command', command: nodeCmd(statusline), padding: 0 };
  log(`  Plugin (skill /bubble + fog-gate hook) — inside Claude Code run:`);
  log(`    /plugin marketplace add ${slash(REPO)}`);
  log(`    /plugin install bubble-planner@bubble-coding`);
  log(`  or for development:  claude --plugin-dir "${slash(REPO)}"`);

  if (ctx.applyStatusline) {
    const file = path.join(os.homedir(), '.claude', 'settings.json');
    const settings = readJson(file);
    if (settings.statusLine && !String(settings.statusLine.command || '').includes('statusline.js')) {
      log(`  ! replacing existing statusLine: ${JSON.stringify(settings.statusLine)}`);
    }
    settings.statusLine = statusLine;
    writeJson(file, settings);
  } else {
    log(`  Status line (plugins can't set it) — add to ~/.claude/settings.json, or rerun with --apply-statusline:`);
    log(`    "statusLine": ${JSON.stringify(statusLine)}`);
  }
}

function codex(ctx) {
  log('\n[codex] Codex CLI');
  const skillDir = installSkill(ctx.base);
  const { gate } = scriptsOf(skillDir);
  const file = path.join(ctx.base, '.codex', 'hooks.json');
  const settings = upsertHook(readJson(file), 'PreToolUse', {
    matcher: 'apply_patch|Edit|Write',
    hooks: [{ type: 'command', command: nodeCmd(gate), timeout: 10, statusMessage: 'bubble fog gate' }],
  });
  writeJson(file, settings);
  log(`  Use it with: $bubble   (Codex will ask you to trust the hook the first time it sees it)`);
}

function gemini(ctx) {
  log('\n[gemini] Gemini CLI');
  const skillDir = installSkill(ctx.base);
  const { gate, cli } = scriptsOf(skillDir);
  const file = path.join(ctx.base, '.gemini', 'settings.json');
  const settings = upsertHook(readJson(file), 'BeforeTool', {
    matcher: 'write_file|replace',
    hooks: [{ name: 'bubble-fog-gate', type: 'command', command: nodeCmd(gate), timeout: 10000 }],
  });
  writeJson(file, settings);
  const toml = fs.readFileSync(path.join(ADAPTERS, 'gemini', 'bubble.toml'), 'utf8').split('{{CLI}}').join(slash(cli));
  writeFile(path.join(ctx.base, '.gemini', 'commands', 'bubble.toml'), toml);
  log(`  Use it with: /bubble   (Gemini warns once before running a new hook)`);
}

function agentsMd(ctx) {
  log('\n[agents-md] AGENTS.md (soft gate, any AGENTS.md-aware agent)');
  if (ctx.user) {
    log('  skipped: AGENTS.md is per repo — use --project <dir>');
    return;
  }
  const skillDir = installSkill(ctx.base);
  const { cli, skillMd } = scriptsOf(skillDir);
  const rel = (p) => slash(path.relative(ctx.base, p));
  const block = fs
    .readFileSync(path.join(ADAPTERS, 'agents-md.md'), 'utf8')
    .split('{{CLI}}').join(rel(cli))
    .split('{{SKILL}}').join(rel(skillMd))
    .trim();
  const file = path.join(ctx.base, 'AGENTS.md');
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const re = /<!-- bubble-planner:start -->[\s\S]*?<!-- bubble-planner:end -->/;
  const next = re.test(old) ? old.replace(re, block) : (old.trim() ? old.replace(/\s*$/, '\n\n') : '') + block + '\n';
  writeFile(file, next);
}

// ---------- main ----------

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.agents.length) {
    log(HELP);
    return;
  }
  if (opts.user && opts.project) throw new Error('use either --user or --project, not both');
  DRY = !!opts.dryRun;
  const base = opts.user ? os.homedir() : path.resolve(opts.project || process.cwd());
  const ctx = { ...opts, base };
  log(`Bubble Planner -> ${opts.user ? 'user' : 'project'}: ${base}${DRY ? '  (dry run)' : ''}`);

  const run = { claude, codex, gemini, 'agents-md': agentsMd };
  for (const agent of opts.agents) run[agent](ctx);
  log('\nDone. Start a track with:  node "<skill>/scripts/bubble.js" init "<title>"  (or ask the agent: /bubble)');
}

try {
  main();
} catch (err) {
  console.error(`install: ${err.message}`);
  process.exitCode = 1;
}
