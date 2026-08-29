import type { LyricLine } from "./types";

// Matches one or more leading [mm:ss.xx] (or [mm:ss.xxx]) tags, e.g. a line
// repeated at multiple timestamps: "[00:12.34][00:45.67]same lyric".
const TAG_PATTERN = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function tagToMs(minutes: string, seconds: string, fraction?: string): number {
  const min = Number(minutes);
  const sec = Number(seconds);
  let frac = 0;
  if (fraction) {
    // 2-digit fractions are centiseconds (xx), 3-digit are milliseconds.
    frac = fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
  }
  return min * 60_000 + sec * 1000 + frac;
}

/**
 * Parses lrclib's `.lrc` format ("[MM:SS.xx] line") into timestamped,
 * time-sorted lyric lines. Lines without a valid tag are skipped.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];

  for (const rawLine of lrc.split("\n")) {
    const tags = [...rawLine.matchAll(TAG_PATTERN)];
    if (tags.length === 0) continue;

    const text = rawLine.replace(TAG_PATTERN, "").trim();
    if (!text) continue;

    for (const [, minutes, seconds, fraction] of tags) {
      lines.push({ timeMs: tagToMs(minutes, seconds, fraction), text });
    }
  }

  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Binary search for the index of the active line at `positionMs` — the
 * last line whose timestamp has already passed. Returns -1 before the
 * first line starts. O(log n) so it's safe to call every animation frame.
 */
export function findActiveLineIndex(lines: LyricLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return result;
}
