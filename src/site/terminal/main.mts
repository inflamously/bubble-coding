// The demo page. It wires the parts together around the CLI (bundled in, see build.mjs):
//   terminal – the screen shell  – runs a command line (bubble-web underneath)
//   disk     – the .bubble-tracks/ panel  player – plays demo/story.md after an intro
//   header   – scene track and controls
import { Disk } from './disk.mjs';
import { $ } from './dom.mjs';
import { Header } from './header.mjs';
import { Player } from './player.mjs';
import { PROJECT, Shell } from './shell.mjs';
import type { Scene } from './story.mjs';
import { Terminal } from './terminal.mjs';
import { FRESH_DISK } from './text.mjs';

/** demo/story.md as scenes, inlined by build.mjs (esbuild `define`). */
declare const STORY: Scene[];
const story = STORY;

const term = new Terminal();
const shell = new Shell(term, {
  booted: () => disk.reset(),
  ran: () => disk.refresh(),
  reset: () => {
    player.end();
    shell.boot();
    term.print(FRESH_DISK, 'hint');
  },
  replay: () => player.jump(0),
});
const disk = new Disk(() => shell.machine, PROJECT);
const header = new Header(story, {
  toggle: () => player.toggle(),
  step: () => player.step(),
  back: () => player.back(),
  skip: () => player.skip(),
  restart: () => player.jump(0),
  toggleSpeed: () => player.toggleSpeed(),
  jump: (si) => player.jump(si),
});
const player = new Player(story, { term, shell, header });

// ── keyboard ──

const cmd = $<HTMLInputElement>('cmd');

/** The prompt: Enter runs, ↑/↓ walk the history, Ctrl+L clears, Ctrl+C drops the line. */
cmd.addEventListener('keydown', (e) => {
  const typing = e.key.length === 1 && !e.metaKey && !e.ctrlKey;
  if (player.playing && (typing || e.key === 'Enter')) player.pause();

  if (e.key === 'Enter') {
    const text = cmd.value;
    cmd.value = '';
    if (text.trim()) shell.history.push(text);
    shell.historyAt = shell.history.length;
    shell.exec(text);
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    const at = shell.historyAt + (e.key === 'ArrowUp' ? -1 : 1);
    shell.historyAt = Math.max(0, Math.min(shell.history.length, at));
    cmd.value = shell.history[shell.historyAt] ?? '';
  } else if (e.ctrlKey && e.key === 'l') {
    term.clear();
  } else if (e.ctrlKey && e.key === 'c' && cmd.selectionStart === cmd.selectionEnd) {
    term.line(`${shell.prompt()} ${cmd.value}^C`);
    cmd.value = '';
  } else return;
  e.preventDefault();
});

/** During the intro, any key starts the story. */
addEventListener('keydown', (e) => {
  if (player.inIntro && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== 'Tab') {
    e.preventDefault();
    player.play();
  }
});

term.screen.addEventListener('click', () => {
  if (!getSelection()?.toString()) cmd.focus({ preventScroll: true });
});

shell.boot();
player.intro();
