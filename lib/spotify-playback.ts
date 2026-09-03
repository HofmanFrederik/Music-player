import { getValidAccessToken } from "./spotify-auth";

export class SpotifyPlaybackError extends Error {}

// Spotify's playback-control endpoints (next/previous/play/pause/seek) —
// unlike the read-only "currently playing" one this app already polls —
// require an active Spotify Connect device and, per Spotify's own docs,
// a Premium account; a Free account gets a 403 here even with the right
// scope granted. Shared by every control call below so they all surface
// the same friendly message for the caller's toast instead of a raw
// status code — not worth pre-checking account tier (would need an
// extra call to /me just to read it).
async function assertPlaybackControlOk(res: Response, actionLabel: string): Promise<void> {
  if (res.status === 403) {
    throw new SpotifyPlaybackError(`${actionLabel} vereist Spotify Premium en een actief apparaat.`);
  }
  if (res.status === 404) {
    throw new SpotifyPlaybackError("Geen actief Spotify-apparaat gevonden.");
  }
  if (!res.ok && res.status !== 204) {
    throw new SpotifyPlaybackError(`${actionLabel} mislukt (${res.status}).`);
  }
}

async function callPlaybackControl(endpoint: "next" | "previous"): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyPlaybackError("Niet verbonden met Spotify.");

  const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertPlaybackControlOk(res, "Overslaan");
}

export function skipToNext(): Promise<void> {
  return callPlaybackControl("next");
}

export function skipToPrevious(): Promise<void> {
  return callPlaybackControl("previous");
}

interface SavedTracksResponse {
  total?: number;
  items?: { track?: { uri?: string } }[];
}

/**
 * Spotify has no "random track from the whole catalog" endpoint, so
 * "random song" here means a random pick from the user's own Liked Songs
 * — the one bounded, meaningful collection the API actually exposes a
 * count for. Needs user-library-read (a new scope alongside the two
 * already requested) to read it, and user-modify-playback-state (already
 * requested for skip) to actually start it playing.
 */
export async function playRandomSavedTrack(): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyPlaybackError("Niet verbonden met Spotify.");
  const headers = { Authorization: `Bearer ${token}` };

  const countRes = await fetch("https://api.spotify.com/v1/me/tracks?limit=1", { headers });
  if (!countRes.ok) throw new SpotifyPlaybackError(`Kon bibliotheek niet ophalen (${countRes.status}).`);
  const countData: SavedTracksResponse = await countRes.json();
  const total = countData.total ?? 0;
  if (total === 0) throw new SpotifyPlaybackError("Geen opgeslagen nummers gevonden in je Spotify-bibliotheek.");

  const offset = Math.floor(Math.random() * total);
  const trackRes = await fetch(`https://api.spotify.com/v1/me/tracks?limit=1&offset=${offset}`, { headers });
  if (!trackRes.ok) throw new SpotifyPlaybackError(`Kon nummer niet ophalen (${trackRes.status}).`);
  const trackData: SavedTracksResponse = await trackRes.json();
  const uri = trackData.items?.[0]?.track?.uri;
  if (!uri) throw new SpotifyPlaybackError("Geen nummer gevonden.");

  const playRes = await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [uri] }),
  });
  await assertPlaybackControlOk(playRes, "Afspelen");
}
