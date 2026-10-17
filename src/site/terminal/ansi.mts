import { el } from './dom.mjs';

/**
 * Text with ANSI SGR codes (what the CLI prints) as spans. Only what a terminal palette needs:
 * bold, dim, the 16 foreground colors and their resets. Classes are a-b, a-d and a-<code>.
 */
export function ansi(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  let weight = '';
  let color = '';
  text.split(/\x1b\[([\d;]*)m/).forEach((part, i) => {
    if (i % 2 === 0) {
      if (part) frag.append(el('span', [weight, color].filter(Boolean).join(' '), part));
      return;
    }
    for (const code of (part || '0').split(';').map(Number)) {
      if (code === 0) weight = color = '';
      else if (code === 1) weight = 'a-b';
      else if (code === 2) weight = 'a-d';
      else if (code === 22) weight = '';
      else if (code === 39) color = '';
      else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) color = `a-${code}`;
    }
  });
  return frag;
}
