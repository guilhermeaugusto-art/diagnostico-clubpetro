import { CONFIG } from "./config";
import type { AppState } from "./state";

interface PersistedState extends AppState {
  savedAt: number;
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(
      CONFIG.STATE_KEY,
      JSON.stringify({ ...state, savedAt: Date.now() })
    );
  } catch {
    /* quota or private mode, silently ignored */
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(CONFIG.STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    const ageDays = (Date.now() - (parsed.savedAt || 0)) / 86_400_000;
    if (ageDays > CONFIG.STATE_TTL_DAYS) {
      localStorage.removeItem(CONFIG.STATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(CONFIG.STATE_KEY);
  } catch {
    /* silent */
  }
}
