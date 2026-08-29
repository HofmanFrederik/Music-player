"use client";

import { useCallback, useState } from "react";
import { addHistoryEntry, clearHistory, loadHistory, type HistoryEntry } from "@/lib/history";

export function useHistory() {
  // Lazy init reads localStorage once on mount; safe from hydration
  // mismatches because this state never affects the server-rendered
  // output (the history screen it feeds is only shown after a click).
  const [entries, setEntries] = useState<HistoryEntry[]>(() => loadHistory());

  const record = useCallback((title: string, artist: string, coverUrl: string | null) => {
    setEntries(addHistoryEntry({ title, artist, coverUrl }));
  }, []);

  const clear = useCallback(() => {
    clearHistory();
    setEntries([]);
  }, []);

  return { entries, record, clear };
}
