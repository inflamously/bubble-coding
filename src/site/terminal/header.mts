import { $, button, el } from './dom.mjs';
import type { Scene } from './story.mjs';

/** What the header shows about the player. */
export interface PlayerState {
  playing: boolean;
  started: boolean;
  atEnd: boolean;
  speed: number;
}

/** What the header's controls ask for. */
export interface HeaderActions {
  toggle(): void;
  step(): void;
  back(): void;
  skip(): void;
  restart(): void;
  toggleSpeed(): void;
  jump(scene: number): void;
}

/** The top bar: which scene is on, the scenes as a bubble track, and the controls. */
export class Header {
  private readonly story: Scene[];
  private readonly track = $('scenes');

  constructor(story: Scene[], actions: HeaderActions) {
    this.story = story;
    story.forEach((scene, si) => {
      const b = button('', () => actions.jump(si));
      b.title = `${si + 1}. ${scene.title}`;
      b.setAttribute('aria-label', `Play from scene ${si + 1}: ${scene.title}`);
      this.track.append(el('li', '', b));
    });
    // The stage fills the window below the bar, whose height changes as its contents wrap.
    const bar = $('topbar');
    new ResizeObserver(() => document.documentElement.style.setProperty('--topbar-h', `${bar.offsetHeight}px`)).observe(bar);
    $('play').addEventListener('click', () => actions.toggle());
    $('back').addEventListener('click', () => actions.back());
    $('step').addEventListener('click', () => actions.step());
    $('skip').addEventListener('click', () => actions.skip());
    $('restart').addEventListener('click', () => actions.restart());
    $('speed').addEventListener('click', () => actions.toggleSpeed());
  }

  /** Scene `si` is on: -1 is the intro, story.length is the end. */
  show(si: number): void {
    const total = this.story.length;
    const [label, title] = si < 0 ? ['Intro', 'Welcome'] : si >= total ? ['Done', 'Your turn'] : [`Scene ${si + 1} of ${total}`, this.story[si].title];
    $('scene-num').textContent = label;
    $('scene-title').textContent = title;
    [...this.track.children].forEach((li, i) => {
      li.className = i < si ? 'done' : i === si ? 'active' : '';
      li.firstElementChild?.setAttribute('aria-current', i === si ? 'step' : 'false');
    });
  }

  update(state: PlayerState): void {
    $('play').textContent = state.playing ? 'Pause' : state.atEnd ? 'Replay' : state.started ? 'Resume' : 'Play';
    $('speed').textContent = `${state.speed}×`;
    $<HTMLButtonElement>('back').disabled = !state.started;
    $<HTMLButtonElement>('step').disabled = state.atEnd;
    $<HTMLButtonElement>('skip').disabled = state.atEnd;
  }
}
