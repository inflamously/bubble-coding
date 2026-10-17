'use strict';
// The demo page: a small shell around the browser CLI (bubble-web.js), a player for the scenes of
// demo/story.md (story.js), and a view of the .bubbles/ files on the in-memory disk.
(function () {
  const { createMachine, words } = self.BubbleWeb;
  const SOURCES = self.BUBBLE_SOURCES;
  const STORY = self.BUBBLE_STORY;
  const HOME = '/home/demo';
  const PROJECT = HOME + '/todo-app';

  const $ = (id) => document.getElementById(id);
  const out = $('out');
  const screen = $('screen');
  const cmd = $('cmd');
  const typed = $('typed');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Output ──────────────────────────────────────────────────────────────

  /** Text with ANSI color codes (what the CLI prints) as spans. */
  function ansi(text) {
    const frag = document.createDocumentFragment();
    let classes = [];
    const parts = text.split(/\x1b\[([\d;]*)m/);
    parts.forEach((part, i) => {
      if (i % 2) {
        for (const code of (part || '0').split(';').map(Number)) {
          if (code === 0) classes = [];
          else if (code === 1) classes.push('a-b');
          else if (code === 2) classes.push('a-d');
          else if (code === 22) classes = classes.filter((c) => c !== 'a-b' && c !== 'a-d');
          else if (code === 39) classes = classes.filter((c) => !/^a-\d/.test(c));
          else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) classes = classes.filter((c) => !/^a-\d/.test(c)).concat(`a-${code}`);
        }
      } else if (part) {
        const span = document.createElement('span');
        if (classes.length) span.className = classes.join(' ');
        span.textContent = part;
        frag.append(span);
      }
    });
    return frag;
  }

  function line(content, className) {
    const div = document.createElement('div');
    if (className) div.className = className;
    if (typeof content === 'string') div.append(ansi(content));
    else div.append(content);
    out.append(div);
    return div;
  }

  /** Several lines of program output; a trailing newline doesn't add an empty line. */
  function print(text, className) {
    for (const l of text.replace(/\n$/, '').split('\n')) line(l, className);
  }

  const scrollDown = () => {
    screen.scrollTop = screen.scrollHeight;
  };

  // ── The shell ───────────────────────────────────────────────────────────

  let machine;
  const history = [];
  let historyAt = 0;

  function boot() {
    machine = createMachine(SOURCES, { cwd: PROJECT });
    machine.fs.writeFileSync(PROJECT + '/README.md', '# todo-app\n\nA tiny todo CLI. Planned with Bubble Planner.\n');
    out.textContent = '';
    snapshot = new Map();
    pinned = null;
    updatePrompt();
    refreshDisk();
  }

  const tilde = (p) => (p === HOME ? '~' : p.startsWith(HOME + '/') ? '~' + p.slice(HOME.length) : p);

  function updatePrompt() {
    $('ps1').textContent = `${tilde(machine.cwd())} $`;
    $('term-title').textContent = `demo@bubble: ${tilde(machine.cwd())}`;
  }

  const HELP = [
    'bubble <command>   the Bubble Planner CLI (try: bubble help, bubble show, bubble tracks)',
    'ls [-a] [path]     list a directory',
    'cat <file>         print a file',
    'cd [dir] · pwd     move around',
    'clear              clear the screen',
    'reset              start over on an empty disk',
    'replay             play the story again',
  ].join('\n');

  function ls(args) {
    const all = args.includes('-a') || args.includes('-la') || args.includes('-al');
    const paths = args.filter((a) => !a.startsWith('-'));
    const targets = paths.length ? paths : ['.'];
    targets.forEach((p, i) => {
      const abs = machine.path.resolve(p);
      if (!machine.fs.existsSync(abs)) return print(`ls: cannot access '${p}': No such file or directory`, 'err');
      if (!machine.fs.statSync(abs).isDirectory()) return print(p);
      if (targets.length > 1) print(`${i ? '\n' : ''}${p}:`);
      const names = machine.fs.readdirSync(abs).filter((n) => all || !n.startsWith('.'));
      const row = document.createElement('span');
      names.forEach((n, j) => {
        const isDir = machine.fs.statSync(machine.path.join(abs, n)).isDirectory();
        const span = document.createElement('span');
        if (isDir) span.className = 'dir';
        span.textContent = isDir ? n + '/' : n;
        row.append(span, j < names.length - 1 ? '  ' : '');
      });
      if (names.length) line(row);
    });
  }

  function cat(args) {
    if (!args.length) return print('cat: missing file operand', 'err');
    for (const p of args) {
      const abs = machine.path.resolve(p);
      if (!machine.fs.existsSync(abs)) print(`cat: ${p}: No such file or directory`, 'err');
      else if (machine.fs.statSync(abs).isDirectory()) print(`cat: ${p}: Is a directory`, 'err');
      else print(machine.fs.readFileSync(abs));
    }
  }

  /** Run one command line, echoing it after the prompt like a terminal would. */
  function exec(text) {
    const echo = document.createElement('span');
    const ps1 = document.createElement('span');
    ps1.className = 'ps1';
    ps1.textContent = `${tilde(machine.cwd())} $ `;
    const cmdText = document.createElement('span');
    cmdText.className = 'cmdtext';
    cmdText.textContent = text;
    echo.append(ps1, cmdText);
    line(echo, 'echo');

    let argv;
    try {
      argv = words(text);
    } catch (err) {
      print(`shell: ${err.message}`, 'err');
      return scrollDown();
    }
    const [name, ...args] = argv;
    switch (name) {
      case undefined:
        break;
      case 'bubble': {
        const res = machine.bubble(args);
        for (const o of res.out) print(o.text, o.stream === 'stderr' ? 'err' : undefined);
        break;
      }
      case 'ls':
        ls(args);
        break;
      case 'cat':
        cat(args);
        break;
      case 'cd':
        try {
          machine.cd(args[0] ? args[0].replace(/^~(?=\/|$)/, HOME) : HOME);
        } catch (err) {
          print(err.message, 'err');
        }
        updatePrompt();
        break;
      case 'pwd':
        print(machine.cwd());
        break;
      case 'clear':
        out.textContent = '';
        break;
      case 'help':
        print(HELP);
        break;
      case 'reset':
        player.stop();
        boot();
        print('A fresh disk. Start with: bubble switch my-plan "My plan"', 'hint');
        break;
      case 'replay':
        player.jump(0);
        return undefined;
      default:
        print(`${name}: command not found. Type help to see what this terminal runs.`, 'err');
    }
    refreshDisk();
    scrollDown();
    return undefined;
  }

  cmd.addEventListener('keydown', (e) => {
    if (player.playing && !e.metaKey && !e.ctrlKey && e.key.length === 1) player.pause();
    if (e.key === 'Enter') {
      const text = cmd.value;
      cmd.value = '';
      if (text.trim()) history.push(text);
      historyAt = history.length;
      if (player.playing) player.pause();
      exec(text);
    } else if (e.key === 'ArrowUp' && historyAt > 0) {
      cmd.value = history[--historyAt];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      historyAt = Math.min(history.length, historyAt + 1);
      cmd.value = history[historyAt] || '';
      e.preventDefault();
    } else if (e.key === 'l' && e.ctrlKey) {
      out.textContent = '';
      e.preventDefault();
    } else if (e.key === 'c' && e.ctrlKey && cmd.selectionStart === cmd.selectionEnd) {
      line(`${$('ps1').textContent} ${cmd.value}^C`);
      cmd.value = '';
      e.preventDefault();
    }
  });
  screen.addEventListener('click', () => {
    if (!getSelection().toString()) cmd.focus({ preventScroll: true });
  });

  // ── The disk view ───────────────────────────────────────────────────────

  let snapshot = new Map();
  let selected = null;
  let pinned = null;

  function bubblesDir() {
    return machine.path.join(PROJECT, '.bubbles');
  }

  function highlight(json) {
    const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return esc.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null|\d+)\b/g, (m, str, colon, lit) => {
      if (lit) return `<span class="j-lit">${lit}</span>`;
      return colon ? `<span class="j-key">${str}</span>${colon}` : `<span class="j-str">${str}</span>`;
    });
  }

  function refreshDisk() {
    const dir = bubblesDir();
    const list = $('files');
    const names = machine.fs.existsSync(dir) ? machine.fs.readdirSync(dir) : [];
    const changed = [];
    const next = new Map();
    for (const n of names) {
      const content = machine.fs.readFileSync(machine.path.join(dir, n));
      next.set(n, content);
      if (snapshot.get(n) !== content) changed.push(n);
    }
    snapshot = next;
    const current = next.has('current') ? next.get('current').trim() + '.json' : null;
    // The most recent track file that changed, unless the visitor picked one.
    const latest = changed.filter((n) => n !== 'current').pop() || changed[0];
    if (pinned && next.has(pinned)) selected = pinned;
    else if (latest) selected = latest;
    else if (!next.has(selected)) selected = current || names[0] || null;

    list.textContent = '';
    if (!names.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Empty. The first bubble switch creates it.';
      list.append(li);
    }
    for (const n of names) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = n;
      b.setAttribute('aria-pressed', String(n === selected));
      if (n === current) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'current';
        b.append(tag);
      }
      if (changed.includes(n)) b.classList.add('flash');
      b.addEventListener('click', () => {
        pinned = pinned === n ? null : n;
        selected = n;
        refreshDisk();
      });
      li.append(b);
      list.append(li);
    }
    const view = $('file-view');
    if (selected && next.has(selected)) view.innerHTML = highlight(next.get(selected));
    else view.textContent = '';
  }

  // ── The story player ────────────────────────────────────────────────────

  const steps = [];
  STORY.forEach((scene, si) => {
    steps.push({ kind: 'scene', si });
    for (const s of scene.steps) steps.push({ ...s, si });
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const player = {
    pos: 0,
    playing: false,
    gen: 0,
    scene: 0,
    finished: false,

    /** Do one step. `fast` skips the typing and the pauses. Returns false if it was interrupted. */
    async perform(step, fast, gen) {
      const alive = () => fast || gen === this.gen;
      if (step.kind === 'scene') {
        showScene(step.si);
        if (!fast) await sleep(500);
      } else if (step.kind === 'say') {
        const who = document.createElement('span');
        who.className = `who ${step.who}`;
        who.textContent = step.who;
        const body = document.createElement('span');
        body.append(who, ` › ${step.text}`);
        line(body, 'say');
        scrollDown();
        if (!fast) await sleep(Math.min(2600, 700 + step.text.length * 22));
      } else if (step.kind === 'run') {
        if (!fast && !reduceMotion) {
          for (let i = 1; i <= step.line.length; i++) {
            if (!alive()) return false;
            typed.textContent = step.line.slice(0, i);
            scrollDown();
            await sleep(step.line[i - 1] === ' ' ? 45 : 26);
          }
          await sleep(260);
        }
        if (!alive()) {
          typed.textContent = '';
          return false;
        }
        typed.textContent = '';
        exec(step.line);
        if (!fast) await sleep(step.line.startsWith('bubble done') || step.line.startsWith('cat') ? 1500 : 1000);
      }
      return alive();
    },

    async play() {
      if (this.playing) return;
      if (this.pos >= steps.length) return this.jump(0);
      this.playing = true;
      const gen = ++this.gen;
      updateControls();
      while (gen === this.gen && this.pos < steps.length) {
        const ok = await this.perform(steps[this.pos], false, gen);
        if (!ok || gen !== this.gen) return;
        this.pos++;
      }
      if (gen === this.gen) this.finish();
    },

    pause() {
      this.playing = false;
      this.gen++;
      typed.textContent = '';
      updateControls();
    },

    stop() {
      this.pause();
      this.pos = steps.length;
      this.finished = true;
      updateControls();
    },

    async step() {
      this.pause();
      if (this.pos >= steps.length) return;
      // A scene heading alone shows nothing new; take the step after it too.
      do await this.perform(steps[this.pos++], true);
      while (this.pos < steps.length && steps[this.pos - 1].kind === 'scene');
      if (this.pos >= steps.length) this.finish();
      updateControls();
    },

    async skip() {
      this.pause();
      while (this.pos < steps.length) await this.perform(steps[this.pos++], true);
      this.finish();
    },

    /** Start over and play from scene `si`, running the scenes before it at once. */
    async jump(si) {
      this.pause();
      boot();
      this.pos = 0;
      this.finished = false;
      while (this.pos < steps.length && steps[this.pos].si < si) await this.perform(steps[this.pos++], true);
      this.play();
    },

    finish() {
      this.playing = false;
      this.finished = true;
      this.pos = steps.length;
      showScene(STORY.length);
      print('\nYour turn. This is the real CLI on a disk in this tab. Try: bubble tracks · bubble switch todo · bubble done · help', 'hint');
      scrollDown();
      updateControls();
    },
  };

  // ── Scene bar ───────────────────────────────────────────────────────────

  const sceneList = $('scenes');
  STORY.forEach((scene, si) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.title = `${si + 1}. ${scene.title}`;
    b.setAttribute('aria-label', `Play from scene ${si + 1}: ${scene.title}`);
    b.addEventListener('click', () => player.jump(si));
    li.append(b);
    sceneList.append(li);
  });

  function showScene(si) {
    player.scene = si;
    const done = si >= STORY.length;
    $('scene-num').textContent = done ? `All ${STORY.length} scenes played` : `Scene ${si + 1} of ${STORY.length}`;
    $('scene-title').textContent = done ? 'Your turn' : STORY[si].title;
    $('scene-note').textContent = done ? 'Type any command below. Restart plays the story from the top.' : STORY[si].notes.join(' ');
    [...sceneList.children].forEach((li, i) => {
      li.className = i < si ? 'done' : i === si ? 'active' : '';
      li.firstChild.setAttribute('aria-current', i === si ? 'step' : 'false');
    });
  }

  function updateControls() {
    const play = $('play');
    play.textContent = player.playing ? 'Pause' : player.pos >= steps.length ? 'Replay' : player.pos ? 'Resume' : 'Play';
    $('step').disabled = player.pos >= steps.length;
    $('skip').disabled = player.pos >= steps.length;
  }

  $('play').addEventListener('click', () => (player.playing ? player.pause() : player.play()));
  $('step').addEventListener('click', () => player.step());
  $('skip').addEventListener('click', () => player.skip());
  $('restart').addEventListener('click', () => player.jump(0));

  boot();
  showScene(0);
  updateControls();
  player.play();
})();
