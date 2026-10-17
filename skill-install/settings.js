"use strict";
// Agent settings files (Claude / Codex / Gemini JSON): read them, and swap in our fog-gate hook.
Object.defineProperty(exports, "__esModule", { value: true });
exports.readSettings = readSettings;
exports.upsertHook = upsertHook;
const io_1 = require("./io");
function readSettings(file) {
    const text = (0, io_1.readText)(file)?.trim();
    if (!text)
        return {};
    try {
        return JSON.parse(text);
    }
    catch (err) {
        throw new Error(`${file} is not plain JSON (${err.message}) — add the entry by hand`);
    }
}
const isFogGate = (group) => (group.hooks || []).some((h) => String(h.command || '').includes('fog-gate.js'));
/** Replace any previous bubble entry for `event`, then append ours. */
function upsertHook(settings, event, entry) {
    settings.hooks ??= {};
    settings.hooks[event] = [...(settings.hooks[event] || []).filter((g) => !isFogGate(g)), entry];
    return settings;
}
