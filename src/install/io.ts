// Installer I/O: repo paths, adapter templates, and writes that honour --dry-run.

import fs = require('node:fs');
import path = require('node:path');

/** This compiles to install/io.js, one level below the repo root. */
export const REPO = path.join(__dirname, '..');
export const SKILL_SRC = path.join(REPO, 'skills', 'bubble');
const ADAPTERS = path.join(REPO, 'adapters');

export function log(msg: string): void {
  console.log(msg);
}

/** Forward slashes work for node on Windows too, and avoid escaping trouble in JSON/TOML/shell. */
export function slash(p: string): string {
  return p.split(path.sep).join('/');
}

export function nodeCmd(script: string): string {
  return `node "${slash(script)}"`;
}

/** The file's text, or null if it doesn't exist. */
export function readText(file: string): string | null {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/** An adapters/ file with every {{KEY}} replaced. */
export function template(name: string, vars: Record<string, string>): string {
  return fs.readFileSync(path.join(ADAPTERS, name), 'utf8').replace(/\{\{(\w+)\}\}/g, (m, key) => vars[key] ?? m);
}

export interface Writer {
  dryRun: boolean;
  /** Write `content` if it changed, keeping the old file as `.bak`. */
  file(file: string, content: string): void;
  json(file: string, obj: unknown): void;
}

export function createWriter(dryRun: boolean): Writer {
  function file(target: string, content: string): void {
    const old = readText(target);
    if (old === content) return log(`  = unchanged  ${target}`);
    if (dryRun) return log(`  ~ would write ${target}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (old !== null) fs.writeFileSync(`${target}.bak`, old, 'utf8');
    fs.writeFileSync(target, content, 'utf8');
    log(old === null ? `  + created  ${target}` : `  ~ updated  ${target} (backup: .bak)`);
  }
  return { dryRun, file, json: (f, obj) => file(f, JSON.stringify(obj, null, 2) + '\n') };
}
