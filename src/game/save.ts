import { SAVE_KEY, SAVE_VERSION } from "./config";
import type { SaveData } from "./types";

const defaults = (): SaveData => ({
  version: SAVE_VERSION,
  unlocked: 1,
  bestEndless: 0,
  sfx: true,
  music: true,
  shakeOn: true,
});

function migrate(raw: SaveData): SaveData {
  const base = defaults();
  return { ...base, ...raw, version: SAVE_VERSION };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || typeof parsed !== "object") return defaults();
    return migrate(parsed);
  } catch {
    return defaults();
  }
}

export function writeSave(data: SaveData): void {
  try {
    const blob = JSON.stringify({ ...data, version: SAVE_VERSION });
    localStorage.setItem(SAVE_KEY, blob);
  } catch {
    /* private mode / quota */
  }
}
