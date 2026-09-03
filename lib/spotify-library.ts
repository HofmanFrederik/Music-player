import { getValidAccessToken } from "./spotify-auth";

export class SpotifyLibraryError extends Error {}

async function authedHeaders(): Promise<HeadersInit> {
  const token = await getValidAccessToken();
  if (!token) throw new SpotifyLibraryError("Niet verbonden met Spotify.");
  return { Authorization: `Bearer ${token}` };
}

/** Whether the given track is already in the user's Liked Songs. */
export async function isTrackSaved(trackId: string): Promise<boolean> {
  const headers = await authedHeaders();
  const res = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`, { headers });
  if (!res.ok) throw new SpotifyLibraryError(`Kon liked-status niet ophalen (${res.status}).`);
  const data: boolean[] = await res.json();
  return data[0] ?? false;
}

export async function saveTrack(trackId: string): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, { method: "PUT", headers });
  if (!res.ok) throw new SpotifyLibraryError(`Toevoegen aan Liked Songs mislukt (${res.status}).`);
}

export async function removeTrack(trackId: string): Promise<void> {
  const headers = await authedHeaders();
  const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, { method: "DELETE", headers });
  if (!res.ok) throw new SpotifyLibraryError(`Verwijderen uit Liked Songs mislukt (${res.status}).`);
}
