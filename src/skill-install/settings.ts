// Agent settings files (Claude / Codex / Gemini JSON): read them, and swap in our fog-gate hook.

import { readText } from './io.js';

export interface HookGroup {
  matcher?: string;
  hooks?: { command?: string; [key: string]: unknown }[];
  [key: string]: unknown;
}

/** The parts of a settings file we touch; everything else is kept as is. */
export interface Settings {
  hooks?: Record<string, HookGroup[]>;
  statusLine?: { command?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export function readSettings(file: string): Settings {
  const text = readText(file)?.trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not plain JSON (${(err as Error).message}) — add the entry by hand`);
  }
}

const isFogGate = (group: HookGroup): boolean => (group.hooks || []).some((h) => String(h.command || '').includes('fog-gate.js'));

/** Replace any previous bubble entry for `event`, then append ours. */
export function upsertHook(settings: Settings, event: string, entry: HookGroup): Settings {
  settings.hooks ??= {};
  settings.hooks[event] = [...(settings.hooks[event] || []).filter((g) => !isFogGate(g)), entry];
  return settings;
}
