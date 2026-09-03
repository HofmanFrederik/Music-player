import { BASE_PATH } from "./base-path";

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
// user-modify-playback-state is for the skip next/previous buttons — added
// after the initial "show what's playing" version shipped, so anyone who
// connected before this needs to reconnect once (a token only carries the
// scopes it was originally granted; Spotify doesn't retroactively add new
// ones to an existing grant).
const SCOPES = "user-read-currently-playing user-read-playback-state user-modify-playback-state";

const TOKENS_KEY = "spotify_tokens";
const VERIFIER_KEY = "spotify_code_verifier";

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function redirectUri(): string {
  return `${window.location.origin}${BASE_PATH}/spotify-callback`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export function getStoredTokens(): SpotifyTokens | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(TOKENS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeTokens(tokens: SpotifyTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}

/**
 * Kicks off Authorization Code + PKCE — no client secret needed, so this
 * whole flow (including the token exchange in handleCallback below) runs
 * entirely client-side, matching this app's "no backend user accounts"
 * shape everywhere else. The code_verifier only needs to survive the
 * redirect round-trip, so sessionStorage (not localStorage) is enough.
 */
export async function startAuth(): Promise<void> {
  if (!CLIENT_ID) throw new Error("NEXT_PUBLIC_SPOTIFY_CLIENT_ID ontbreekt.");

  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- external OAuth redirect (accounts.spotify.com), not an internal route
  window.location.href = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

/** Exchanges the redirect's ?code for tokens and stores them. Called by the spotify-callback page. */
export async function handleCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error("Geen code_verifier gevonden voor deze sessie.");
  sessionStorage.removeItem(VERIFIER_KEY);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID!,
    code_verifier: verifier,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify-token ophalen mislukt (${res.status}).`);
  const data = await res.json();

  storeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
}

async function refreshTokens(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID!,
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Spotify-token vernieuwen mislukt (${res.status}).`);
  const data = await res.json();

  // Spotify doesn't always rotate the refresh token on refresh — keep the
  // existing one when it doesn't send a new one.
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  storeTokens(tokens);
  return tokens;
}

/**
 * Returns a usable access token, refreshing first if it's expired or about
 * to be. Null means "not connected" (no stored tokens, or the refresh
 * itself failed — e.g. the user revoked access — in which case the stale
 * tokens are cleared so the app falls back to showing "disconnected").
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken;

  try {
    const refreshed = await refreshTokens(tokens.refreshToken);
    return refreshed.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}
