// What the terminal says on its own, outside the story.

export const INTRO = [
  '\x1b[34mS ●──●──◐──○──❓ F\x1b[0m   \x1b[33mPlan only as far as you can see.\x1b[0m',
  '',
  'bubble-tracks keeps a coding agent on one linear track of task bubbles.',
  'The agent plans what it can see. Anything unclear stays fog, and only',
  'the human plans fog. After every bubble the agent stops, so you can',
  'move, insert, remove or fork bubbles before the next one starts.',
  '',
  'This terminal runs the real CLI on a disk that lives in this tab.',
  '',
  '●\x1b[2m done  \x1b[0m◐\x1b[2m active  \x1b[0m○\x1b[2m todo  \x1b[0m❓\x1b[2m fog: unplanned, the human plans it\x1b[0m',
  '',
];

export const HELP = `bubble <command>   the bubble-tracks CLI (try: bubble help, bubble show, bubble tracks)
ls [-a] [path]     list a directory
cat <file>         print a file
cd [dir] · pwd     move around
clear              clear the screen
reset              start over on an empty disk
replay             play the story again`;

export const YOUR_TURN = '\nYour turn. This is the real CLI on a disk in this tab. Try: bubble tracks · bubble switch todo · bubble done · help';
export const FRESH_DISK = 'A fresh disk. Start with: bubble switch my-plan "My plan"';
export const countdown = (seconds: number) => `The demo starts in ${seconds}…  Press any key or Play to start now.`;

/** "bubble-tracks" in figlet's standard font, built from its letters so the columns line up. One line; the CSS shrinks it to fit. */
export function banner(): string[] {
  const letters: Record<string, string[]> = {
    b: [' _     ', '| |__  ', "| '_ \\ ", '| |_) |', '|_.__/ '],
    u: ['       ', ' _   _ ', '| | | |', '| |_| |', ' \\__,_|'],
    l: [' _ ', '| |', '| |', '| |', '|_|'],
    e: ['      ', '  ___ ', ' / _ \\', '|  __/', ' \\___|'],
    '-': ['       ', '       ', ' _____ ', '|_____|', '       '],
    t: [' _   ', '| |_ ', '| __|', '| |_ ', ' \\__|'],
    r: ['      ', ' _ __ ', "| '__|", '| |   ', '|_|   '],
    a: ['       ', '  __ _ ', ' / _` |', '| (_| |', ' \\__,_|'],
    c: ['      ', '  ___ ', ' / __|', '| (__ ', ' \\___|'],
    k: [' _    ', '| | __', '| |/ /', '|   < ', '|_|\\_\\'],
    s: ['     ', ' ___ ', '/ __|', '\\__ \\', '|___/'],
  };
  return [0, 1, 2, 3, 4].map((row) => [...'bubble-tracks'].map((ch) => letters[ch][row]).join('').trimEnd());
}
