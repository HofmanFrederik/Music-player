"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { IdleScreen } from "@/components/IdleScreen";
import { InfoScreen } from "@/components/InfoScreen";
import { BlurredBackground } from "@/components/BlurredBackground";
import { ActionButtons } from "@/components/ActionButtons";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import type { RecognitionResult } from "@/lib/types";

type RecognitionState =
  | { status: "loading" }
  | { status: "success"; result: RecognitionResult }
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
        setState({ status: "success", result: data });
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

      {capture.status === "stopped" && capture.blob && (
        <ResultView blob={capture.blob} onRetry={capture.reset} />
      )}

      {capture.status === "error" && (
        <ErrorState message={capture.error} onRetry={capture.reset} />
      )}
    </main>
  );
}

function ResultView({ blob, onRetry }: { blob: Blob; onRetry: () => void }) {
  const recognition = useRecognition(blob);
  const [view, setView] = useState<"info" | "lyrics">("info");
  // Timer + real position land in M4 — static for now.
  const progress = 0;

  if (recognition.status === "loading") {
    return <LoadingState />;
  }

  if (recognition.status === "error") {
    return <ErrorState message={recognition.message} onRetry={onRetry} />;
  }

  const { result } = recognition;

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
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-black">
      <motion.p
        className="text-sm text-white/70"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        Herkennen&hellip;
      </motion.p>
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
