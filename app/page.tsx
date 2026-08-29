"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { IdleScreen } from "@/components/IdleScreen";
import { InfoScreen } from "@/components/InfoScreen";
import { BlurredBackground } from "@/components/BlurredBackground";
import { ActionButtons } from "@/components/ActionButtons";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useIdleArtwork } from "@/hooks/useIdleArtwork";
import { useTrackTimer } from "@/hooks/useTrackTimer";
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

export default function Home() {
  const capture = useAudioCapture();

  const showIdle =
    capture.status === "idle" ||
    capture.status === "requesting-permission" ||
    capture.status === "recording";

  return (
    <main className="flex flex-1 flex-col">
      {showIdle && (
        <IdleScreen
          onTap={capture.start}
          recording={capture.status === "recording"}
          disabled={capture.status === "requesting-permission"}
        />
      )}

      {capture.status === "stopped" && capture.blob && capture.recordedAt && (
        <ResultView blob={capture.blob} recordedAt={capture.recordedAt} onRetry={capture.reset} />
      )}

      {capture.status === "error" && (
        <ErrorState message={capture.error} onRetry={capture.reset} />
      )}
    </main>
  );
}

function ResultView({
  blob,
  recordedAt,
  onRetry,
}: {
  blob: Blob;
  recordedAt: number;
  onRetry: () => void;
}) {
  const recognition = useRecognition(blob);

  if (recognition.status === "loading") {
    return <LoadingState />;
  }

  if (recognition.status === "error") {
    return <ErrorState message={recognition.message} onRetry={onRetry} />;
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
  const { progress, finished } = useTrackTimer({
    durationMs: result.durationMs,
    playOffsetMs: result.playOffsetMs,
    recordedAt,
    respondedAt,
  });

  // Spec: once the estimated position runs past the track's duration, the
  // song is over — go back to idle rather than sitting on a stale screen.
  useEffect(() => {
    if (finished) onRetry();
  }, [finished, onRetry]);

  if (view === "lyrics") {
    return (
      <div className="relative flex-1 w-full overflow-hidden">
        <BlurredBackground src={result.coverUrl ?? undefined} />
        <div className="relative z-10 flex h-full w-full items-center justify-center">
          <p className="text-sm text-white/60">Songtekst volgt in M5.</p>
        </div>
        <ActionButtons
          youtubeVideoId={result.youtubeVideoId}
          spotifyTrackId={result.spotifyTrackId}
          onToggleLyrics={() => setView("info")}
          progress={progress}
        />
      </div>
    );
  }

  return (
    <InfoScreen result={result} onToggleLyrics={() => setView("lyrics")} progress={progress} />
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
