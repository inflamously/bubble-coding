import fs from 'node:fs';
import path from 'node:path';

/** The committed CLI (bubble.js and lib/**), keyed by forward-slash path relative to `cliDir`. */
export function cliSources(cliDir: string): Record<string, string> {
  const files = ['bubble.js', ...fs.readdirSync(path.join(cliDir, 'lib'), { recursive: true }).map((f) => path.join('lib', String(f)))];
  const sources: Record<string, string> = {};
  for (const f of files.filter((f) => f.endsWith('.js')).sort()) {
    sources[f.split(path.sep).join('/')] = fs.readFileSync(path.join(cliDir, f), 'utf8');
  }
  return sources;
}
