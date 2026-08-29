"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { IdleScreen } from "@/components/IdleScreen";
import { InfoScreen } from "@/components/InfoScreen";
import { LyricsScreen } from "@/components/LyricsScreen";
import { BlurredBackground } from "@/components/BlurredBackground";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useIdleArtwork } from "@/hooks/useIdleArtwork";
import { useTrackTimer } from "@/hooks/useTrackTimer";
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

    fetch("/api/recognise", { method: "POST", body: formData })
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

    fetch(`/api/lyrics?${params.toString()}`)
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
      {showIdle && (
        <IdleScreen
          onTap={capture.start}
          recording={capture.status === "recording"}
          disabled={capture.status === "requesting-permission"}
        />
      )}

      {capture.status === "stopped" && capture.blob && capture.recordedAt && (
        <ResultView
          blob={capture.blob}
          recordedAt={capture.recordedAt}
          onRetry={capture.reset}
          notify={notify}
        />
      )}

      {capture.status === "error" && (
        // Mic access itself is broken here — auto-retrying is pointless, and
        // a fresh getUserMedia call needs a real user gesture, so this stays
        // a blocking prompt (call capture.start directly, not reset, so the
        // tap counts as that gesture) rather than a toast.
        <ErrorState message={capture.error} onRetry={capture.start} />
      )}

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

  if (recognition.status === "loading" || recognition.status === "error") {
    return <LoadingState />;
  }

  return (
    <TrackView
      result={recognition.result}
      recordedAt={recordedAt}
      respondedAt={recognition.respondedAt}
      onRetry={onRetry}
    />
  );
}

function TrackView({
  result,
  recordedAt,
  respondedAt,
  onRetry,
}: {
  result: RecognitionResult;
  recordedAt: number;
  respondedAt: number;
  onRetry: () => void;
}) {
  const [view, setView] = useState<"info" | "lyrics">("info");
  const { positionMs, progress, finished } = useTrackTimer({
    durationMs: result.durationMs,
    playOffsetMs: result.playOffsetMs,
    recordedAt,
    respondedAt,
  });
  // Fetched once in the background as soon as we have a match, so it's
  // already there the moment the user toggles to the lyrics view.
  const lyrics = useLyrics(result.artist, result.title, result.durationMs);

  // Spec: once the estimated position runs past the track's duration, the
  // song is over — go back to idle (which resumes listening) rather than
  // sitting on a stale screen.
  useEffect(() => {
    if (finished) onRetry();
  }, [finished, onRetry]);

  const hasSyncedLyrics = lyrics.status === "ready" && !!lyrics.syncedLines?.length;
  const hasPlainLyrics = lyrics.status === "ready" && !!lyrics.plainLyrics;
  const lyricsDisabled = lyrics.status === "unavailable" || (lyrics.status === "ready" && !hasSyncedLyrics && !hasPlainLyrics);

  if (view === "lyrics") {
    return (
      <LyricsScreen
        result={result}
        positionMs={positionMs}
        syncedLines={lyrics.status === "ready" ? lyrics.syncedLines : null}
        plainLyrics={lyrics.status === "ready" ? lyrics.plainLyrics : null}
        onToggleInfo={() => setView("info")}
        progress={progress}
      />
    );
  }

  return (
    <InfoScreen
      result={result}
      onToggleLyrics={() => setView("lyrics")}
      lyricsDisabled={lyricsDisabled}
      progress={progress}
    />
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
