import { ansi } from './ansi.mjs';
import { $, el } from './dom.mjs';

/** The screen: lines of output, and the half-typed command the player shows at the prompt. */
export class Terminal {
  readonly out = $('out');
  readonly screen = $('screen');
  readonly typed = $('typed');

  /** One line: a string (ANSI colors allowed) or a node. */
  line(content: string | Node, className = ''): HTMLDivElement {
    const div = el('div', className, typeof content === 'string' ? ansi(content) : content);
    this.out.append(div);
    return div;
  }

  /** Program output; a trailing newline doesn't add an empty line. */
  print(text: string, className = ''): void {
    for (const l of text.replace(/\n$/, '').split('\n')) this.line(l, className);
  }

  clear(): void {
    this.out.textContent = '';
  }

  scrollDown(): void {
    this.screen.scrollTop = this.screen.scrollHeight;
  }
}
