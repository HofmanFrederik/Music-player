"use client";

import { useCallback, useEffect, useState } from "react";
import { clearTokens, getStoredTokens, getValidAccessToken, startAuth } from "@/lib/spotify-auth";
import { skipToNext, skipToPrevious } from "@/lib/spotify-playback";

// Spotify's own state takes a moment to update after a skip command —
// polling immediately often still shows the track that just ended. A
// short delay before the extra poll makes the UI actually reflect the
// new track most of the time; the regular interval is the safety net for
// the rest.
const POST_SKIP_POLL_DELAY_MS = 400;

export interface SpotifyNowPlaying {
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  durationMs: number;
  progressMs: number;
  spotifyTrackId: string | null;
  /** When this snapshot was polled — lets the timer continue counting from progressMs in real time. */
  polledAt: number;
}

const POLL_INTERVAL_MS = 5000;

interface SpotifyPlayingItem {
  name: string;
  artists: { name: string }[];
  album?: { name?: string; images?: { url: string }[] };
  duration_ms: number;
  id?: string;
}

/**
 * Polls Spotify's own "what's playing" endpoint while connected, so the
 * app can show real playback state instead of relying on the microphone —
 * user-requested, replaces mic listening whenever Spotify reports an
 * actively playing track (see components/SpotifyTrackView.tsx and its
 * wiring into app/page.tsx's Home). `nowPlaying` is null both when
 * disconnected and when connected-but-nothing's-playing; callers don't
 * need to distinguish those cases, both mean "fall back to the mic."
 */
interface CurrentlyPlayingResponse {
  is_playing?: boolean;
  progress_ms?: number;
  currently_playing_type?: string;
  item?: SpotifyPlayingItem;
}

export function useSpotifyPlayback() {
  const [connected, setConnected] = useState(false);
  const [nowPlaying, setNowPlaying] = useState<SpotifyNowPlaying | null>(null);

  // Unlike useHistory's lazy init, this can't safely read localStorage
  // during the initial render: `connected` directly flips a visible icon
  // (IdleScreen's Link2/Unlink2) that's part of the default render tree,
  // so a value that differs between the server's guess (always
  // disconnected) and the client's real one (from localStorage) would be
  // a genuine hydration mismatch, not just internal state no one sees yet.
  // Deferring the real check to after mount keeps server and client
  // rendering the same disconnected icon on the first pass.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setConnected(getStoredTokens() !== null);
  }, []);

  const poll = useCallback(() => {
    getValidAccessToken().then((token) => {
      if (!token) {
        setConnected(false);
        setNowPlaying(null);
        return;
      }
      setConnected(true);

      fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          // 204 = authenticated but nothing playing right now.
          if (res.status === 204 || !res.ok) return null;
          return res.json() as Promise<CurrentlyPlayingResponse>;
        })
        .then((data) => {
          if (!data || !data.is_playing || data.currently_playing_type !== "track" || !data.item) {
            setNowPlaying(null);
            return;
          }
          const item = data.item;
          setNowPlaying({
            title: item.name,
            artist: item.artists.map((a) => a.name).join(", "),
            album: item.album?.name ?? null,
            coverUrl: item.album?.images?.[0]?.url ?? null,
            durationMs: item.duration_ms,
            progressMs: data.progress_ms ?? 0,
            spotifyTrackId: item.id ?? null,
            polledAt: Date.now(),
          });
        })
        .catch(() => setNowPlaying(null));
    });
  }, []);

  useEffect(() => {
    if (!connected) return;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [connected, poll]);

  const connect = useCallback(() => {
    startAuth();
  }, []);

  const disconnect = useCallback(() => {
    clearTokens();
    setConnected(false);
    setNowPlaying(null);
  }, []);

  const skipNext = useCallback(async () => {
    await skipToNext();
    setTimeout(poll, POST_SKIP_POLL_DELAY_MS);
  }, [poll]);

  const skipPrevious = useCallback(async () => {
    await skipToPrevious();
    setTimeout(poll, POST_SKIP_POLL_DELAY_MS);
  }, [poll]);

  return { connected, nowPlaying, connect, disconnect, skipNext, skipPrevious };
}
