import { getValidAccessToken } from "./spotify-auth";

export class SpotifyPlaybackError extends Error {}

// Spotify's playback-control endpoints (next/previous/play/pause/seek) —
// unlike the read-only "currently playing" one this app already polls —
// require an active Spotify Connect device and, per Spotify's own docs,
// a Premium account; a Free account gets a 403 here even with the right
// scope granted. Surfaced as a normal error for the caller to show a
// toast for, not something worth pre-checking (would need an extra call
// to /me just to read the account tier).
async function callPlaybackControl(endpoint: "next" | "previous"): Promise<void> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyPlaybackError("Niet verbonden met Spotify.");

  const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 403) {
    throw new SpotifyPlaybackError("Overslaan vereist Spotify Premium en een actief apparaat.");
  }
  if (res.status === 404) {
    throw new SpotifyPlaybackError("Geen actief Spotify-apparaat gevonden.");
  }
  if (!res.ok && res.status !== 204) {
    throw new SpotifyPlaybackError(`Overslaan mislukt (${res.status}).`);
  }
}

export function skipToNext(): Promise<void> {
  return callPlaybackControl("next");
}

export function skipToPrevious(): Promise<void> {
  return callPlaybackControl("previous");
}
