import type { Machine } from '../bubble-web/index.mjs';
import { $, button, el } from './dom.mjs';

/** The .bubbles/ panel: one button per file, and the open file's JSON. */
export class Disk {
  private files = new Map<string, string>(); // name -> content, as of the last refresh
  private selected: string | null = null;
  private pinned: string | null = null; // picked by the visitor; stays open until picked again
  private readonly list = $('files');
  private readonly view = $('file-view');
  private readonly dir: string;
  private readonly machine: () => Machine;

  constructor(machine: () => Machine, project: string) {
    this.machine = machine;
    this.dir = `${project}/.bubbles`;
  }

  reset(): void {
    this.files = new Map();
    this.selected = this.pinned = null;
    this.refresh();
  }

  /** Read .bubbles/ again and open the file that changed last, unless one is pinned. */
  refresh(): void {
    const { fs, path } = this.machine();
    const names = fs.existsSync(this.dir) ? fs.readdirSync(this.dir) : [];
    const files = new Map(names.map((n) => [n, fs.readFileSync(path.join(this.dir, n))]));
    const changed = names.filter((n) => this.files.get(n) !== files.get(n));
    this.files = files;

    const current = files.has('current') ? `${files.get('current')?.trim()}.json` : null;
    const latest = changed.filter((n) => n !== 'current').pop() ?? changed[0];
    if (this.pinned && files.has(this.pinned)) this.selected = this.pinned;
    else if (latest) this.selected = latest;
    else if (!this.selected || !files.has(this.selected)) this.selected = current ?? names[0] ?? null;

    this.render(names, current, changed);
  }

  private render(names: string[], current: string | null, changed: string[]): void {
    this.list.textContent = '';
    if (!names.length) this.list.append(el('li', 'empty', 'Empty. The first bubble switch creates it.'));
    for (const name of names) {
      const b = button(name, () => this.pin(name), changed.includes(name) ? 'flash' : '');
      if (name === current) b.append(el('span', 'tag', 'current'));
      b.setAttribute('aria-pressed', String(name === this.selected));
      this.list.append(el('li', '', b));
    }
    const content = this.selected ? this.files.get(this.selected) : undefined;
    if (content === undefined) this.view.textContent = '';
    else this.view.innerHTML = highlightJson(content);
  }

  private pin(name: string): void {
    this.pinned = this.pinned === name ? null : name;
    this.selected = name;
    this.refresh();
  }
}

/** JSON as HTML with keys, strings and literals in spans. */
function highlightJson(json: string): string {
  const escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return escaped.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null|\d+)\b/g, (_m, str: string, colon: string, literal: string) => {
    if (literal) return `<span class="j-lit">${literal}</span>`;
    return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
  });
}
