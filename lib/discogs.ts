const API_BASE = "https://api.discogs.com";
const USER_AGENT = "MusicRecognizerPWA/1.0 (+https://frederikhofman.be/music-player)";

export interface CreditEntry {
  name: string;
  roles: string[];
}

export interface SongCredits {
  releaseTitle: string;
  entries: CreditEntry[];
}

export class CreditsNotFoundError extends Error {
  constructor() {
    super("Geen bezetting gevonden.");
    this.name = "CreditsNotFoundError";
  }
}

interface DiscogsArtistCredit {
  name: string;
  role: string;
  tracks: string;
}

interface DiscogsTrack {
  position: string;
  title: string;
  extraartists?: DiscogsArtistCredit[];
}

interface DiscogsRelease {
  title: string;
  tracklist: DiscogsTrack[];
  extraartists?: DiscogsArtistCredit[];
}

interface DiscogsSearchResult {
  id: number;
  format?: string[];
  year?: number;
}

function authedUrl(path: string, params: Record<string, string>): string {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) throw new Error("DISCOGS_TOKEN ontbreekt.");
  const search = new URLSearchParams({ ...params, token });
  return `${API_BASE}${path}?${search.toString()}`;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Discogs' `track=` search matches on tracklist contents, but in practice
 * ranks releases *titled* after the song (7" singles, promos) far above
 * the album that actually contains it — searching "Bohemian Rhapsody"
 * never surfaced "A Night at the Opera" in 50 results, even though that's
 * exactly where the real personnel credits live. Searching by the album's
 * own title instead goes straight to the right release. Falls back to a
 * track= search (best-effort, prefers an official non-"Unofficial
 * Release" match) when there's no album name to search with, or it comes
 * up empty.
 */
async function findRelease(artist: string, title: string, album: string | null): Promise<number | null> {
  if (album) {
    const url = authedUrl("/database/search", { release_title: album, artist, type: "release" });
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) {
      const data: { results: DiscogsSearchResult[] } = await res.json();
      // Search relevance ranking favors whatever's most-collected, which
      // tends to be the newest remaster/reissue — but those releases are
      // usually only credited for the remaster work (engineer, mastering),
      // not the original performers. The oldest official pressing is the
      // one most likely to carry the original liner-notes personnel.
      const official = data.results.filter((r) => !r.format?.includes("Unofficial Release"));
      const dated = official.filter((r) => r.year).sort((a, b) => a.year! - b.year!);
      const best = dated[0] ?? official[0] ?? data.results[0];
      if (best) return best.id;
    }
  }

  const url = authedUrl("/database/search", { track: title, artist, type: "release" });
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Discogs search antwoordde met status ${res.status}.`);
  const data: { results: DiscogsSearchResult[] } = await res.json();
  const best = data.results.find((r) => !r.format?.includes("Unofficial Release")) ?? data.results[0];
  return best?.id ?? null;
}

// A person can show up with the same role from both the track-level and
// release-level credit lists (e.g. the release's general "Producer" entry
// alongside a track-specific one) — dedupe per (name, role) pair.
function addRoles(entries: Map<string, Set<string>>, name: string, role: string) {
  if (!role) return;
  if (!entries.has(name)) entries.set(name, new Set());
  entries.get(name)!.add(role);
}

function trackAppliesTo(creditTracks: string, position: string | undefined): boolean {
  if (!creditTracks) return true; // empty = applies to the whole release
  if (!position) return false;
  return creditTracks
    .split(",")
    .map((t) => t.trim())
    .includes(position);
}

/**
 * "Who worked on this song and which instruments did they play" — not in
 * the original spec, user-requested. Discogs is the source (not
 * MusicBrainz, which had far sparser instrument-level credit data in
 * testing, even for extremely well-documented songs) via its free,
 * token-authenticated API. Two-step lookup: search for the release, then
 * fetch its full tracklist+credits and combine the credits scoped to this
 * exact track with the release-wide ones (session musicians are very often
 * credited once for a whole album rather than repeated per track).
 */
export async function fetchCredits(artist: string, title: string, album: string | null = null): Promise<SongCredits> {
  const releaseId = await findRelease(artist, title, album);
  if (!releaseId) throw new CreditsNotFoundError();

  const releaseUrl = authedUrl(`/releases/${releaseId}`, {});
  const releaseRes = await fetch(releaseUrl, { headers: { "User-Agent": USER_AGENT } });
  if (releaseRes.status === 404) throw new CreditsNotFoundError();
  if (!releaseRes.ok) throw new Error(`Discogs antwoordde met status ${releaseRes.status}.`);
  const release: DiscogsRelease = await releaseRes.json();

  const track = release.tracklist.find((t) => normalize(t.title) === normalize(title));

  const entries = new Map<string, Set<string>>();

  for (const credit of track?.extraartists ?? []) {
    addRoles(entries, credit.name, credit.role);
  }
  for (const credit of release.extraartists ?? []) {
    if (trackAppliesTo(credit.tracks, track?.position)) {
      addRoles(entries, credit.name, credit.role);
    }
  }

  if (entries.size === 0) throw new CreditsNotFoundError();

  return {
    releaseTitle: release.title,
    entries: Array.from(entries, ([name, roles]) => ({ name, roles: Array.from(roles) })),
  };
}
