"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { InfoScreen } from "./InfoScreen";
import { LyricsScreen } from "./LyricsScreen";
import { AlbumScreen } from "./AlbumScreen";
import { WikiInfoScreen } from "./WikiInfoScreen";
import { Screen } from "./Screen";
import { useLyrics } from "@/hooks/useLyrics";
import type { SpotifyNowPlaying } from "@/hooks/useSpotifyPlayback";
import type { RecognitionResult } from "@/lib/types";

type ViewState = "info" | "lyrics" | "album" | "songInfo" | "artistInfo";

/**
 * useTrackTimer (the mic-flow timer) intentionally anchors its position
 * once per mount and never re-syncs — correct there, since a new match
 * always remounts with a fresh anchor anyway. This component deliberately
 * does *not* remount on every poll (same song keeps its instance, see the
 * class doc below), so reusing that hook here meant a seek in Spotify
 * never caught up: it kept extrapolating from the very first poll's
 * progressMs forever. This re-syncs to nowPlaying's latest progressMs on
 * every render via a ref the RAF loop reads each frame — a fresh poll
 * (including one that shows a seek) is reflected within one animation
 * frame after it arrives, not ignored.
 */
function useLivePosition(nowPlaying: SpotifyNowPlaying, durationMs: number) {
  const nowPlayingRef = useRef(nowPlaying);
  useEffect(() => {
    nowPlayingRef.current = nowPlaying;
  }, [nowPlaying]);

  const [positionMs, setPositionMs] = useState(() => nowPlaying.progressMs);

  useEffect(() => {
    let frameId: number;

    const tick = () => {
      const current = nowPlayingRef.current;
      const position = current.progressMs + (Date.now() - current.polledAt);
      setPositionMs(Math.min(position, durationMs));
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs]);

  const progress = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  return { positionMs, progress };
}

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
 *
 * onSkipPrevious/onSkipNext are always passed through to Info/Lyrics here
 * (unlike TrackView, which never has them — mic-recognized matches aren't
 * something this app controls playback of) — Home already wraps the raw
 * Spotify API calls with error handling/a toast, so this component just
 * forwards them as-is.
 */
export function SpotifyTrackView({
  nowPlaying,
  onMatch,
  onSkipPrevious,
  onSkipNext,
}: {
  nowPlaying: SpotifyNowPlaying;
  onMatch: (result: RecognitionResult) => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
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

  const { positionMs, progress } = useLivePosition(nowPlaying, result.durationMs);
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
            onSkipPrevious={onSkipPrevious}
            onSkipNext={onSkipNext}
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
            onSkipPrevious={onSkipPrevious}
            onSkipNext={onSkipNext}
          />
        </Screen>
      )}
    </AnimatePresence>
  );
}
