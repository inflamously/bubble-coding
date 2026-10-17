// demo/story.md as data: what src/site/build parses and the player plays.

/** A caption (what the human or the agent says) or a command line to run. */
export type Step = { kind: 'say'; who: string; text: string } | { kind: 'run'; line: string };

export interface Scene {
  title: string;
  /** Paragraphs between the steps, shown with the scene. */
  notes: string[];
  steps: Step[];
}
