"use client";

import { useEffect, useMemo, useState } from "react";
import { IdleScreen } from "@/components/IdleScreen";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import type { RecognitionResult } from "@/lib/types";

type RecognitionState =
  | { status: "loading" }
  | { status: "success"; result: RecognitionResult }
  | { status: "error"; message: string };

// Takes a required, stable Blob: RecognitionDebugView only mounts once a
// recording finishes and remounts fresh next time, so "loading" as the
// initial state (rather than set via an effect) is always correct.
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
        <RecognitionDebugView
          blob={capture.blob}
          mimeType={capture.mimeType}
          onRetry={capture.reset}
        />
      )}

      {capture.status === "error" && (
        <ErrorState message={capture.error} onRetry={capture.reset} />
      )}
    </main>
  );
}

// Temporary M2 acceptance UI: proves the signed ACRCloud call works end to
// end by dumping the normalized JSON result. Gets replaced by the real
// Info/Lyrics screens in M3.
function RecognitionDebugView({
  blob,
  mimeType,
  onRetry,
}: {
  blob: Blob;
  mimeType: string | null;
  onRetry: () => void;
}) {
  const recognition = useRecognition(blob);
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto bg-black px-6 py-6 text-center text-white">
      <p className="text-xs text-white/50">
        Opname &mdash; {mimeType ?? "onbekend formaat"}, {(blob.size / 1024).toFixed(0)} KB
      </p>
      <audio controls src={url} className="w-full max-w-xs" />

      {recognition.status === "loading" && (
        <p className="text-sm text-white/70">Herkennen&hellip;</p>
      )}

      {recognition.status === "success" && (
        <pre className="w-full max-w-lg overflow-x-auto rounded-lg bg-white/5 p-4 text-left text-xs text-emerald-300">
          {JSON.stringify(recognition.result, null, 2)}
        </pre>
      )}

      {recognition.status === "error" && (
        <p className="max-w-md text-sm text-red-300">{recognition.message}</p>
      )}

      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-white/30 px-5 py-2 text-sm text-white"
      >
        Opnieuw opnemen
      </button>
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
