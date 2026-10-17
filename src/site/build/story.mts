import type { Scene } from '../terminal/story.mjs';

/**
 * demo/story.md as scenes: `## N. Title` starts one; `> who: text` is a caption; each line in a
 * code block is a command; any other paragraph is a note shown with the scene.
 */
export function parseStory(md: string): Scene[] {
  const scenes: Scene[] = [];
  let inCode = false;
  let paragraph: string[] = [];
  const unquote = (s: string) => s.replace(/`/g, '');
  const endParagraph = () => {
    const scene = scenes.at(-1);
    if (paragraph.length && scene) scene.notes.push(unquote(paragraph.join(' ')));
    paragraph = [];
  };

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    const scene = scenes.at(-1);
    if (line.startsWith('```')) {
      endParagraph();
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      if (line.trim() && scene) scene.steps.push({ kind: 'run', line: line.trim() });
      continue;
    }
    const heading = /^## (?:\d+\.\s*)?(.+)$/.exec(line);
    const say = /^> (\w+): (.+)$/.exec(line);
    if (heading) {
      endParagraph();
      scenes.push({ title: heading[1], notes: [], steps: [] });
    } else if (say) {
      endParagraph();
      scene?.steps.push({ kind: 'say', who: say[1], text: unquote(say[2]) });
    } else if (!line.trim() || line.startsWith('#')) endParagraph();
    else paragraph.push(line.trim());
  }
  endParagraph();
  return scenes;
}
