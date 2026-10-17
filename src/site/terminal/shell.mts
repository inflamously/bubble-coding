import { createMachine, words, type Machine, type Sources } from '../bubble-web/index.mjs';
import { $, el } from './dom.mjs';
import type { Terminal } from './terminal.mjs';
import { HELP } from './text.mjs';

export const HOME = '/home/demo';
export const PROJECT = `${HOME}/todo-app`;

/** What the shell can't do itself: the page around it reacts to these. */
export interface ShellHooks {
  /** After every fresh disk. */
  booted(): void;
  /** After every command: the disk may have changed. */
  ran(): void;
  reset(): void;
  replay(): void;
}

type Command = (args: string[]) => void;

/** A small shell around the browser CLI: `bubble …`, plus enough of ls, cat and cd to look around. */
export class Shell {
  machine!: Machine;
  readonly history: string[] = [];
  historyAt = 0;
  private readonly term: Terminal;
  private readonly sources: Sources;
  private readonly hooks: ShellHooks;
  private readonly commands: Record<string, Command>;

  constructor(term: Terminal, sources: Sources, hooks: ShellHooks) {
    this.term = term;
    this.sources = sources;
    this.hooks = hooks;
    this.commands = {
      bubble: (args) => this.bubble(args),
      ls: (args) => this.ls(args),
      cat: (args) => this.cat(args),
      cd: ([dir]) => this.cd(dir),
      pwd: () => term.print(this.machine.cwd()),
      clear: () => term.clear(),
      help: () => term.print(HELP),
      reset: () => hooks.reset(),
      replay: () => hooks.replay(),
    };
  }

  /** A fresh disk with an empty project on it. */
  boot(): void {
    this.machine = createMachine(this.sources, { cwd: PROJECT });
    this.machine.fs.writeFileSync(`${PROJECT}/README.md`, '# todo-app\n\nA tiny todo CLI. Planned with bubble-coding.\n');
    this.term.clear();
    this.updatePrompt();
    this.hooks.booted();
  }

  prompt(): string {
    const cwd = this.machine.cwd();
    return `${cwd === HOME || cwd.startsWith(`${HOME}/`) ? `~${cwd.slice(HOME.length)}` : cwd} $`;
  }

  /** Run one command line, echoed after the prompt like a terminal would. */
  exec(text: string): void {
    this.term.line(el('span', '', el('span', 'ps1', `${this.prompt()} `), el('span', 'cmdtext', text)), 'echo');
    try {
      const [name, ...args] = words(text);
      if (name === undefined) return;
      const command = this.commands[name];
      if (command) command(args);
      else this.term.print(`${name}: command not found. Type help to see what this terminal runs.`, 'err');
    } catch (err) {
      this.term.print(`shell: ${(err as Error).message}`, 'err');
    } finally {
      this.hooks.ran();
      this.term.scrollDown();
    }
  }

  private updatePrompt(): void {
    $('ps1').textContent = this.prompt();
    $('term-title').textContent = `demo@bubble: ${this.prompt().slice(0, -2)}`;
  }

  private kind(p: string): 'dir' | 'file' | null {
    const { fs } = this.machine;
    if (!fs.existsSync(p)) return null;
    return fs.statSync(p).isDirectory() ? 'dir' : 'file';
  }

  private bubble(args: string[]): void {
    for (const o of this.machine.bubble(args).out) this.term.print(o.text, o.stream === 'stderr' ? 'err' : '');
  }

  private ls(args: string[]): void {
    const { fs, path } = this.machine;
    const all = args.some((a) => a.startsWith('-') && a.includes('a'));
    const paths = args.filter((a) => !a.startsWith('-'));
    const targets = paths.length ? paths : ['.'];
    targets.forEach((p, i) => {
      const abs = path.resolve(p);
      const kind = this.kind(abs);
      if (!kind) return this.term.print(`ls: cannot access '${p}': No such file or directory`, 'err');
      if (kind === 'file') return this.term.print(p);
      if (targets.length > 1) this.term.print(`${i ? '\n' : ''}${p}:`);
      const names = fs.readdirSync(abs).filter((n) => all || !n.startsWith('.'));
      const entries = names.flatMap((n, j) => {
        const entry = this.kind(path.join(abs, n)) === 'dir' ? el('span', 'dir', `${n}/`) : el('span', '', n);
        return j ? ['  ', entry] : [entry];
      });
      if (entries.length) this.term.line(el('span', '', ...entries));
    });
  }

  private cat(args: string[]): void {
    if (!args.length) return this.term.print('cat: missing file operand', 'err');
    for (const p of args) {
      const abs = this.machine.path.resolve(p);
      const kind = this.kind(abs);
      if (kind === 'file') this.term.print(this.machine.fs.readFileSync(abs));
      else this.term.print(`cat: ${p}: ${kind ? 'Is a directory' : 'No such file or directory'}`, 'err');
    }
  }

  private cd(dir: string | undefined): void {
    try {
      this.machine.cd(dir ? dir.replace(/^~(?=\/|$)/, HOME) : HOME);
    } catch (err) {
      this.term.print((err as Error).message, 'err');
    }
    this.updatePrompt();
  }
}
