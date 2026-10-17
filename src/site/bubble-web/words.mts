/** Split a command line like a shell: spaces separate words, '…' and "…" group them. */
export function words(line: string): string[] {
  const out: string[] = [];
  let word: string | null = null;
  let quote: string | null = null;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      word ??= '';
    } else if (/\s/.test(ch)) {
      if (word !== null) out.push(word);
      word = null;
    } else word = (word ?? '') + ch;
  }
  if (quote) throw new Error('unterminated quote');
  if (word !== null) out.push(word);
  return out;
}
