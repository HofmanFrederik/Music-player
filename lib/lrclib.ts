import { parseLrc } from "./lrc";
import type { LyricLine } from "./types";

const LRCLIB_URL = "https://lrclib.net/api/get";
// lrclib asks integrators to identify themselves — browsers won't let client
// JS set a custom User-Agent at all (it's a forbidden header), which is the
// real reason this needs a server-side proxy rather than a direct client call.
const USER_AGENT = "MusicRecognizerPWA/1.0 (+https://lrclib.net)";

export interface LyricsResult {
  instrumental: boolean;
  syncedLyrics: LyricLine[] | null;
  plainLyrics: string | null;
}

interface LrcLibResponse {
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export class LyricsNotFoundError extends Error {
  constructor() {
    super("Geen songtekst gevonden voor dit nummer.");
    this.name = "LyricsNotFoundError";
  }
}

/**
 * Looks up synced lyrics on lrclib.net. `durationSeconds` must be passed
 * (from duration_ms / 1000) or lrclib may match the wrong version — a
 * remix or live recording — and every timestamp ends up wrong.
 */
export async function fetchLyrics(
  artist: string,
  title: string,
  durationSeconds: number
): Promise<LyricsResult> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
    duration: String(Math.round(durationSeconds)),
  });

  const res = await fetch(`${LRCLIB_URL}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (res.status === 404) {
    throw new LyricsNotFoundError();
  }
  if (!res.ok) {
    throw new Error(`lrclib antwoordde met status ${res.status}.`);
  }

  const data: LrcLibResponse = await res.json();

  return {
    instrumental: Boolean(data.instrumental),
    syncedLyrics: data.syncedLyrics ? parseLrc(data.syncedLyrics) : null,
    plainLyrics: data.plainLyrics ?? null,
  };
}
