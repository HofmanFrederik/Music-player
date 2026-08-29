import { findActiveLineIndex } from "@/lib/lrc";
import type { LyricLine } from "@/lib/types";

interface SyncedLyricsLines {
  previous: string | null;
  active: string | null;
  next: string | null;
}

/**
 * Derives the previous/active/next lyric line for the current playback
 * position via binary search (O(log n)) — cheap enough to call every
 * animation frame rather than re-scanning the whole line list.
 */
export function useSyncedLyrics(lines: LyricLine[], positionMs: number): SyncedLyricsLines {
  const activeIndex = findActiveLineIndex(lines, positionMs);

  return {
    previous: activeIndex > 0 ? lines[activeIndex - 1].text : null,
    active: activeIndex >= 0 ? lines[activeIndex].text : null,
    next: activeIndex + 1 < lines.length ? lines[activeIndex + 1].text : null,
  };
}
