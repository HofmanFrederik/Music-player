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
 * Owns `view` (info/lyrics/album/...) *outside* SpotifyTrackView's own
 * remount boundary — SpotifyTrackView is remounted fresh (via the `key`
 * below) whenever the song itself changes, which resets its internal
 * state (timer, lyrics, onMatch's one-shot effect). Without lifting `view`
 * up here too, it would reset right along with everything else, so
 * switching to the next Spotify track always bounced back to the info
 * screen even if lyrics were showing — exactly mirroring why the mic flow
 * splits into TrackController (owns `view`) / TrackView (remounts per
 * match) below in app/page.tsx, for the same reason.
 */
export function SpotifyTrackController({
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
  const songKey = `${nowPlaying.title}::${nowPlaying.artist}`;

  useEffect(() => {
    // Same rule as TrackController's handleSongChanged: lyrics persists
    // across a song change, every other view is stale and resets to info.
    // Deliberately keyed on songKey only, not on every nowPlaying poll of
    // the same song — this is a legitimate "adjust state to match a
    // changed prop" reset, not derived data that belongs in render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setView((v) => (v === "lyrics" ? v : "info"));
  }, [songKey]);

  return (
    <SpotifyTrackView
      key={songKey}
      nowPlaying={nowPlaying}
      view={view}
      onViewChange={setView}
      onMatch={onMatch}
      onSkipPrevious={onSkipPrevious}
      onSkipNext={onSkipNext}
    />
  );
}

function SpotifyTrackView({
  nowPlaying,
  view,
  onViewChange,
  onMatch,
  onSkipPrevious,
  onSkipNext,
}: {
  nowPlaying: SpotifyNowPlaying;
  view: ViewState;
  onViewChange: (view: ViewState) => void;
  onMatch: (result: RecognitionResult) => void;
  onSkipPrevious: () => void;
  onSkipNext: () => void;
}) {
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
            onToggleInfo={() => onViewChange("info")}
            onShowAlbum={() => onViewChange("album")}
            onShowSongInfo={() => onViewChange("songInfo")}
            onShowArtistInfo={() => onViewChange("artistInfo")}
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
            onClose={() => onViewChange("info")}
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
            onClose={() => onViewChange("info")}
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
            onClose={() => onViewChange("info")}
          />
        </Screen>
      ) : (
        <Screen key="info">
          <InfoScreen
            result={result}
            onToggleLyrics={() => onViewChange("lyrics")}
            onShowAlbum={() => onViewChange("album")}
            onShowSongInfo={() => onViewChange("songInfo")}
            onShowArtistInfo={() => onViewChange("artistInfo")}
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
