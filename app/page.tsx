"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { IdleScreen } from "@/components/IdleScreen";
import { InfoScreen } from "@/components/InfoScreen";
import { LyricsScreen } from "@/components/LyricsScreen";
import { BlurredBackground } from "@/components/BlurredBackground";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useIdleArtwork } from "@/hooks/useIdleArtwork";
import { useTrackTimer } from "@/hooks/useTrackTimer";
import { useBackgroundRecognition } from "@/hooks/useBackgroundRecognition";
import { BASE_PATH } from "@/lib/base-path";
import type { LyricLine, RecognitionResult } from "@/lib/types";

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

type LyricsState =
  | { status: "loading" }
  | { status: "ready"; syncedLines: LyricLine[] | null; plainLyrics: string | null }
  | { status: "unavailable" };

function useLyrics(artist: string, title: string, durationMs: number) {
  const [state, setState] = useState<LyricsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      artist_name: artist,
      track_name: title,
      duration: String(Math.round(durationMs / 1000)),
    });

    fetch(`${BASE_PATH}/api/lyrics?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "unavailable" });
          return;
        }
        const data = await res.json();
        setState({ status: "ready", syncedLines: data.syncedLyrics, plainLyrics: data.plainLyrics });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [artist, title, durationMs]);

  return state;
}

// Shared crossfade used everywhere the app switches between full screens
// (idle/result/error, loading/track, info/lyrics) so nothing just snaps.
function Screen({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const capture = useAudioCapture();
  const { status: captureStatus, start: startCapture } = capture;
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((message: string) => setToast(message), []);

  // Always listening: as soon as we're idle (first load, or right after a
  // failed/finished attempt) start recording again automatically — no tap
  // required. The idle screen stays tappable too, as a manual nudge.
  useEffect(() => {
    if (captureStatus === "idle") {
      startCapture();
    }
  }, [captureStatus, startCapture]);

  const showIdle =
    capture.status === "idle" ||
    capture.status === "requesting-permission" ||
    capture.status === "recording";

  return (
    <main className="relative flex flex-1 flex-col">
      <AnimatePresence mode="wait">
        {showIdle && (
          <Screen key="idle">
            <IdleScreen
              onTap={capture.start}
              recording={capture.status === "recording"}
              disabled={capture.status === "requesting-permission"}
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
}: {
  blob: Blob;
  recordedAt: number;
  onRetry: () => void;
  notify: (message: string) => void;
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
}: {
  initialResult: RecognitionResult;
  initialRecordedAt: number;
  initialRespondedAt: number;
  onRetry: () => void;
}) {
  const [match, setMatch] = useState<Match>({
    result: initialResult,
    recordedAt: initialRecordedAt,
    respondedAt: initialRespondedAt,
  });
  const [view, setView] = useState<"info" | "lyrics">("info");

  const handleSongChanged = useCallback(
    (result: RecognitionResult, recordedAt: number, respondedAt: number) => {
      setMatch({ result, recordedAt, respondedAt });
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
}: {
  result: RecognitionResult;
  recordedAt: number;
  respondedAt: number;
  view: "info" | "lyrics";
  onViewChange: (view: "info" | "lyrics") => void;
  onRetry: () => void;
  onSongChanged: (result: RecognitionResult, recordedAt: number, respondedAt: number) => void;
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

  // While this match is showing, keep quietly re-sampling in the
  // background so a song change (skip, next track starting) is caught
  // instead of waiting for the estimated duration timer to run out.
  useBackgroundRecognition(result, onSongChanged);

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
            onToggleInfo={() => onViewChange("info")}
            progress={progress}
          />
        </Screen>
      ) : (
        <Screen key="info">
          <InfoScreen
            result={result}
            onToggleLyrics={() => onViewChange("lyrics")}
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
        <Loader2 className="animate-spin text-white" size={40} strokeWidth={2} />
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
