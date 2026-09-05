"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { IdleScreen } from "@/components/IdleScreen";
import { InfoScreen } from "@/components/InfoScreen";
import { LyricsScreen } from "@/components/LyricsScreen";
import { AlbumScreen } from "@/components/AlbumScreen";
import { WikiInfoScreen } from "@/components/WikiInfoScreen";
import { HistoryScreen } from "@/components/HistoryScreen";
import { BlurredBackground } from "@/components/BlurredBackground";
import { Screen } from "@/components/Screen";
import { SpotifyTrackController } from "@/components/SpotifyTrackView";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useIdleArtwork } from "@/hooks/useIdleArtwork";
import { useTrackTimer } from "@/hooks/useTrackTimer";
import { useBackgroundRecognition } from "@/hooks/useBackgroundRecognition";
import { useLyrics } from "@/hooks/useLyrics";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useHistory } from "@/hooks/useHistory";
import { useSpotifyPlayback } from "@/hooks/useSpotifyPlayback";
import { BASE_PATH } from "@/lib/base-path";
import type { RecognitionResult } from "@/lib/types";

type RecognitionState =
  | { status: "loading" }
  | { status: "success"; result: RecognitionResult; respondedAt: number }
  | { status: "error"; message: string };

// Takes a required, stable Blob: ResultView only mounts once a recording
// finishes and remounts fresh next time, so "loading" as the initial state
// (rather than set via an effect) is always correct.
function useRecognition(blob: Blob) {
  const [state, setState] = useState<RecognitionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const formData = new FormData();
    formData.append("audio", blob, "sample");

    fetch(`${BASE_PATH}/api/recognise`, { method: "POST", body: formData })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          setState({ status: "error", message: data.error ?? `Fout (${res.status})` });
          return;
        }
        setState({ status: "success", result: data, respondedAt: Date.now() });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "Netwerkfout tijdens herkenning." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [blob]);

  return state;
}

export default function Home() {
  const capture = useAudioCapture();
  const { status: captureStatus, start: startCapture, reset: resetCapture } = capture;
  const [toast, setToast] = useState<string | null>(null);
  const history = useHistory();
  const [showHistory, setShowHistory] = useState(false);
  const spotify = useSpotifyPlayback();
  // Lifted above both the mic flow (which remounts TrackController on every
  // idle->recording->recognized cycle) and the Spotify flow, so "lyrics on"
  // is a standing preference rather than per-mount state: once toggled on,
  // the next recognized/played song opens straight on lyrics too, instead
  // of resetting to info the moment the current song ends and a new one
  // starts (reported by the user — lyrics stayed on for background song
  // changes within one match, per TrackController's own handleSongChanged,
  // but not once the song actually finished and listening restarted).
  const [lyricsPreferred, setLyricsPreferred] = useState(false);

  const notify = useCallback((message: string) => setToast(message), []);

  // Screen must stay on for the whole session — the app is always
  // listening, and the device's normal auto-lock would defeat that.
  useWakeLock();

  // Always listening: as soon as we're idle (first load, or right after a
  // failed/finished attempt) start recording again automatically — no tap
  // required. The idle screen stays tappable too, as a manual nudge.
  // Paused while History is open — the user asked for it to genuinely stop
  // listening while browsing past matches, not just skip the next cycle.
  // Also paused while Spotify is actively reporting a playing track — user
  // request: Spotify's own "now playing" replaces the mic entirely while
  // it's actually playing something, no need to burn mic/ACRCloud calls.
  useEffect(() => {
    if (captureStatus === "idle" && !showHistory && !spotify.nowPlaying) {
      startCapture();
    }
  }, [captureStatus, startCapture, showHistory, spotify.nowPlaying]);

  // If Spotify starts playing mid-recording (or mid-result), drop whatever
  // the mic was doing immediately rather than letting it finish first —
  // same reasoning as openHistory below.
  useEffect(() => {
    if (spotify.nowPlaying) resetCapture();
  }, [spotify.nowPlaying, resetCapture]);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    // Stop any in-flight recording immediately rather than letting it finish.
    resetCapture();
  }, [resetCapture]);

  const toggleSpotify = useCallback(() => {
    if (spotify.connected) {
      spotify.disconnect();
    } else {
      spotify.connect();
    }
  }, [spotify]);

  const handleSkipPrevious = useCallback(() => {
    spotify.skipPrevious().catch((error: unknown) => {
      notify(error instanceof Error ? error.message : "Overslaan mislukt.");
    });
  }, [spotify, notify]);

  const handleSkipNext = useCallback(() => {
    spotify.skipNext().catch((error: unknown) => {
      notify(error instanceof Error ? error.message : "Overslaan mislukt.");
    });
  }, [spotify, notify]);

  const handlePlayRandom = useCallback(() => {
    spotify.playRandom().catch((error: unknown) => {
      notify(error instanceof Error ? error.message : "Afspelen mislukt.");
    });
  }, [spotify, notify]);

  const showIdle =
    !spotify.nowPlaying &&
    (capture.status === "idle" ||
      capture.status === "requesting-permission" ||
      capture.status === "recording");

  return (
    <main className="relative flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        {spotify.nowPlaying && (
          // Static key — SpotifyTrackController must NOT remount on a song
          // change (that would reset the `view` state it exists to
          // preserve). It remounts SpotifyTrackView itself, internally,
          // via its own key. See SpotifyTrackView.tsx.
          <Screen key="spotify">
            <SpotifyTrackController
              nowPlaying={spotify.nowPlaying}
              onMatch={history.record}
              onSkipPrevious={handleSkipPrevious}
              onSkipNext={handleSkipNext}
              onError={notify}
              lyricsPreferred={lyricsPreferred}
              onLyricsPreferenceChange={setLyricsPreferred}
            />
          </Screen>
        )}

        {showIdle && showHistory && (
          <Screen key="history">
            <HistoryScreen
              entries={history.entries}
              onClose={() => setShowHistory(false)}
              onClear={history.clear}
            />
          </Screen>
        )}

        {showIdle && !showHistory && (
          <Screen key="idle">
            <IdleScreen
              onTap={capture.start}
              recording={capture.status === "recording"}
              disabled={capture.status === "requesting-permission"}
              onShowHistory={openHistory}
              spotifyConnected={spotify.connected}
              onToggleSpotify={toggleSpotify}
              onPlayRandom={handlePlayRandom}
            />
          </Screen>
        )}

        {capture.status === "stopped" && capture.blob && capture.recordedAt && (
          <Screen key="result">
            <ResultView
              blob={capture.blob}
              recordedAt={capture.recordedAt}
              onRetry={capture.reset}
              notify={notify}
              onMatch={history.record}
              lyricsPreferred={lyricsPreferred}
              onLyricsPreferenceChange={setLyricsPreferred}
            />
          </Screen>
        )}

        {capture.status === "error" && (
          // Mic access itself is broken here — auto-retrying is pointless, and
          // a fresh getUserMedia call needs a real user gesture, so this stays
          // a blocking prompt (call capture.start directly, not reset, so the
          // tap counts as that gesture) rather than a toast.
          <Screen key="capture-error">
            <ErrorState message={capture.error} onRetry={capture.start} />
          </Screen>
        )}
      </AnimatePresence>

      <Toast message={toast} onDone={() => setToast(null)} />
    </main>
  );
}

function ResultView({
  blob,
  recordedAt,
  onRetry,
  notify,
  onMatch,
  lyricsPreferred,
  onLyricsPreferenceChange,
}: {
  blob: Blob;
  recordedAt: number;
  onRetry: () => void;
  notify: (message: string) => void;
  onMatch: (result: RecognitionResult) => void;
  lyricsPreferred: boolean;
  onLyricsPreferenceChange: (preferred: boolean) => void;
}) {
  const recognition = useRecognition(blob);

  // Spec (and product direction): never get stuck on a "no match" screen —
  // surface it as a toast and keep listening automatically.
  useEffect(() => {
    if (recognition.status === "error") {
      notify(recognition.message);
      onRetry();
    }
  }, [recognition, notify, onRetry]);

  return (
    <AnimatePresence mode="wait">
      {recognition.status === "loading" || recognition.status === "error" ? (
        <Screen key="loading">
          <LoadingState />
        </Screen>
      ) : (
        <Screen key="track">
          <TrackController
            initialResult={recognition.result}
            initialRecordedAt={recordedAt}
            initialRespondedAt={recognition.respondedAt}
            onRetry={onRetry}
            onMatch={onMatch}
            lyricsPreferred={lyricsPreferred}
            onLyricsPreferenceChange={onLyricsPreferenceChange}
          />
        </Screen>
      )}
    </AnimatePresence>
  );
}

interface Match {
  result: RecognitionResult;
  recordedAt: number;
  respondedAt: number;
}

type TrackViewState = "info" | "lyrics" | "album" | "songInfo" | "artistInfo";

// Owns "which match is currently on screen" so a song change detected in
// the background can swap it out. TrackView below is remounted (via key)
// whenever the match changes, giving it a clean timer/lyrics-fetch state
// for the new track instead of trying to reset all of that by hand. `view`
// (info vs. lyrics) is owned here instead, so it survives that remount —
// if lyrics were showing when the song changed, the new song opens
// straight on its lyrics too, instead of resetting to info.
function TrackController({
  initialResult,
  initialRecordedAt,
  initialRespondedAt,
  onRetry,
  onMatch,
  lyricsPreferred,
  onLyricsPreferenceChange,
}: {
  initialResult: RecognitionResult;
  initialRecordedAt: number;
  initialRespondedAt: number;
  onRetry: () => void;
  onMatch: (result: RecognitionResult) => void;
  lyricsPreferred: boolean;
  onLyricsPreferenceChange: (preferred: boolean) => void;
}) {
  const [match, setMatch] = useState<Match>({
    result: initialResult,
    recordedAt: initialRecordedAt,
    respondedAt: initialRespondedAt,
  });
  // Read only once as the initial value: this mounts fresh per recognized
  // song cycle, and by then it should follow the *current* standing
  // preference, not react to it changing later while showing.
  const [view, setView] = useState<TrackViewState>(() => (lyricsPreferred ? "lyrics" : "info"));

  const handleSongChanged = useCallback(
    (result: RecognitionResult, recordedAt: number, respondedAt: number) => {
      setMatch({ result, recordedAt, respondedAt });
      // Album/song-info/artist-info are for whatever was showing before —
      // stale once the song changes, so drop back to info (unlike lyrics,
      // which still makes sense to keep showing for whatever's playing now).
      setView((v) => (v === "lyrics" ? v : "info"));
    },
    []
  );

  return (
    <TrackView
      key={`${match.result.title}::${match.result.artist}::${match.recordedAt}`}
      result={match.result}
      recordedAt={match.recordedAt}
      respondedAt={match.respondedAt}
      view={view}
      onViewChange={setView}
      onRetry={onRetry}
      onSongChanged={handleSongChanged}
      onMatch={onMatch}
      onLyricsPreferenceChange={onLyricsPreferenceChange}
    />
  );
}

function TrackView({
  result,
  recordedAt,
  respondedAt,
  view,
  onViewChange,
  onRetry,
  onSongChanged,
  onMatch,
  onLyricsPreferenceChange,
}: {
  result: RecognitionResult;
  recordedAt: number;
  respondedAt: number;
  view: TrackViewState;
  onViewChange: (view: TrackViewState) => void;
  onRetry: () => void;
  onSongChanged: (result: RecognitionResult, recordedAt: number, respondedAt: number) => void;
  onMatch: (result: RecognitionResult) => void;
  onLyricsPreferenceChange: (preferred: boolean) => void;
}) {
  const { positionMs, progress, finished } = useTrackTimer({
    durationMs: result.durationMs,
    playOffsetMs: result.playOffsetMs,
    recordedAt,
    respondedAt,
  });
  // Fetched once in the background as soon as we have a match, so it's
  // already there the moment the user toggles to the lyrics view.
  const lyrics = useLyrics(result.artist, result.title, result.durationMs);

  // Records this song into local history — once per distinct match, since
  // TrackView remounts fresh (new key) whenever the song changes.
  useEffect(() => {
    onMatch(result);
  }, [onMatch, result]);

  // While this match is showing, keep quietly re-sampling in the
  // background so a song change (skip, next track starting) is caught
  // instead of waiting for the estimated duration timer to run out. Checks
  // ramp up as the track nears its end (see the hook) so the next song is
  // found quickly rather than up to a full interval late.
  useBackgroundRecognition(result, result.durationMs - positionMs, onSongChanged);

  // Spec: once the estimated position runs past the track's duration, the
  // song is over — go back to idle (which resumes listening) rather than
  // sitting on a stale screen.
  useEffect(() => {
    if (finished) onRetry();
  }, [finished, onRetry]);

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
            onToggleInfo={() => {
              onViewChange("info");
              onLyricsPreferenceChange(false);
            }}
            onShowAlbum={() => onViewChange("album")}
            onShowSongInfo={() => onViewChange("songInfo")}
            onShowArtistInfo={() => onViewChange("artistInfo")}
            progress={progress}
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
            onToggleLyrics={() => {
              onViewChange("lyrics");
              onLyricsPreferenceChange(true);
            }}
            onShowAlbum={() => onViewChange("album")}
            onShowSongInfo={() => onViewChange("songInfo")}
            onShowArtistInfo={() => onViewChange("artistInfo")}
            lyricsDisabled={lyricsDisabled}
            progress={progress}
            positionMs={positionMs}
          />
        </Screen>
      )}
    </AnimatePresence>
  );
}

function LoadingState() {
  // Keeps the same cycling blurred art the idle screen used, so the
  // transition into "searching" doesn't feel like the app went blank.
  const { url } = useIdleArtwork();

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={url} blurPx={72} />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4">
        <Loader2
          className="h-[clamp(29px,10.26vmin,54px)] w-[clamp(29px,10.26vmin,54px)] animate-spin text-white"
          strokeWidth={2}
        />
        <motion.p
          className="text-sm text-white/70"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          Herkennen&hellip;
        </motion.p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <p className="text-sm text-red-300">{message ?? "Er ging iets mis."}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-white/30 px-5 py-2 text-sm text-white"
      >
        Probeer opnieuw
      </button>
    </div>
  );
}

function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center px-6">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="rounded-full bg-black/80 px-4 py-2 text-xs text-white/90 shadow-lg"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
