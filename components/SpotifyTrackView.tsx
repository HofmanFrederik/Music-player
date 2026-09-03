"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { InfoScreen } from "./InfoScreen";
import { LyricsScreen } from "./LyricsScreen";
import { AlbumScreen } from "./AlbumScreen";
import { WikiInfoScreen } from "./WikiInfoScreen";
import { Screen } from "./Screen";
import { useTrackTimer } from "@/hooks/useTrackTimer";
import { useLyrics } from "@/hooks/useLyrics";
import type { SpotifyNowPlaying } from "@/hooks/useSpotifyPlayback";
import type { RecognitionResult } from "@/lib/types";

type ViewState = "info" | "lyrics" | "album" | "songInfo" | "artistInfo";

/**
 * Spotify-sourced counterpart to TrackView (app/page.tsx) — same leaf
 * screens and view-switching, but driven by real playback data instead of
 * a recorded sample + estimated timer. Two real differences from TrackView:
 *
 * - No useBackgroundRecognition (that's the mic-based "keep re-sampling to
 *   catch a song change" mechanism). Home's own Spotify poll already does
 *   this job by re-rendering with fresh nowPlaying data every ~5s; this
 *   component is remounted fresh only when the *song itself* changes
 *   (Home keys it by title+artist), so React naturally preserves it —
 *   timer, lyrics, current view and all — across polls that just confirm
 *   the same song is still playing.
 * - No "estimated duration ran out -> back to idle" effect. Spotify tells
 *   us directly when playback stops (nowPlaying goes null at the Home
 *   level), so there's nothing to estimate.
 */
export function SpotifyTrackView({
  nowPlaying,
  onMatch,
}: {
  nowPlaying: SpotifyNowPlaying;
  onMatch: (result: RecognitionResult) => void;
}) {
  const [view, setView] = useState<ViewState>("info");

  const result: RecognitionResult = {
    title: nowPlaying.title,
    artist: nowPlaying.artist,
    album: nowPlaying.album,
    coverUrl: nowPlaying.coverUrl,
    genres: [],
    durationMs: nowPlaying.durationMs,
    playOffsetMs: nowPlaying.progressMs,
    youtubeVideoId: null,
    spotifyTrackId: nowPlaying.spotifyTrackId,
  };

  const { positionMs, progress } = useTrackTimer({
    durationMs: result.durationMs,
    playOffsetMs: result.playOffsetMs,
    recordedAt: nowPlaying.polledAt,
    respondedAt: nowPlaying.polledAt,
  });
  const lyrics = useLyrics(result.artist, result.title, result.durationMs);

  useEffect(() => {
    onMatch(result);
    // Only once per distinct song — this component only remounts (fresh
    // effect) when Home's key (title::artist) actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSyncedLyrics = lyrics.status === "ready" && !!lyrics.syncedLines?.length;
  const hasPlainLyrics = lyrics.status === "ready" && !!lyrics.plainLyrics;
  const lyricsDisabled = lyrics.status === "unavailable" || (lyrics.status === "ready" && !hasSyncedLyrics && !hasPlainLyrics);

  return (
    <AnimatePresence mode="wait">
      {view === "lyrics" ? (
        <Screen key="lyrics">
          <LyricsScreen
            result={result}
            positionMs={positionMs}
            syncedLines={lyrics.status === "ready" ? lyrics.syncedLines : null}
            plainLyrics={lyrics.status === "ready" ? lyrics.plainLyrics : null}
            onToggleInfo={() => setView("info")}
            onShowAlbum={() => setView("album")}
            onShowSongInfo={() => setView("songInfo")}
            onShowArtistInfo={() => setView("artistInfo")}
            progress={progress}
          />
        </Screen>
      ) : view === "album" ? (
        <Screen key="album">
          <AlbumScreen
            artist={result.artist}
            title={result.title}
            fallbackCoverUrl={result.coverUrl}
            onClose={() => setView("info")}
          />
        </Screen>
      ) : view === "songInfo" ? (
        <Screen key="songInfo">
          <WikiInfoScreen
            mode="song"
            artist={result.artist}
            title={result.title}
            album={result.album}
            fallbackCoverUrl={result.coverUrl}
            onClose={() => setView("info")}
          />
        </Screen>
      ) : view === "artistInfo" ? (
        <Screen key="artistInfo">
          <WikiInfoScreen
            mode="artist"
            artist={result.artist}
            title={result.title}
            album={result.album}
            fallbackCoverUrl={result.coverUrl}
            onClose={() => setView("info")}
          />
        </Screen>
      ) : (
        <Screen key="info">
          <InfoScreen
            result={result}
            onToggleLyrics={() => setView("lyrics")}
            onShowAlbum={() => setView("album")}
            onShowSongInfo={() => setView("songInfo")}
            onShowArtistInfo={() => setView("artistInfo")}
            lyricsDisabled={lyricsDisabled}
            progress={progress}
            positionMs={positionMs}
          />
        </Screen>
      )}
    </AnimatePresence>
  );
}
