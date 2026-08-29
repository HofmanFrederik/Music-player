const STORAGE_KEY = "music-recognizer:history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  title: string;
  artist: string;
  coverUrl: string | null;
  spotifyTrackId: string | null;
  recognizedAt: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Records a match, newest first, capped at MAX_ENTRIES. Skips writing if
 * it's the same title+artist as the most recent entry, so the periodic
 * background re-checks (which confirm the same song rather than a change)
 * don't spam duplicate rows.
 */
export function addHistoryEntry(entry: Omit<HistoryEntry, "recognizedAt">): HistoryEntry[] {
  const existing = loadHistory();
  const last = existing[0];
  if (last && last.title === entry.title && last.artist === entry.artist) {
    return existing;
  }

  const next = [{ ...entry, recognizedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full/unavailable (e.g. private browsing) — just don't persist.
  }

  return next;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clean up if storage isn't available anyway.
  }
}
