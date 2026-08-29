"use client";

import { useEffect, useMemo } from "react";
import { IdleScreen } from "@/components/IdleScreen";
import { useAudioCapture } from "@/hooks/useAudioCapture";

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
        <RecordingPreview blob={capture.blob} mimeType={capture.mimeType} onRetry={capture.reset} />
      )}

      {capture.status === "error" && (
        <ErrorState message={capture.error} onRetry={capture.reset} />
      )}
    </main>
  );
}

// Temporary M1 acceptance UI — proves the recording pipeline works end to
// end. Gets replaced in M2 by the real /api/recognise call.
function RecordingPreview({
  blob,
  mimeType,
  onRetry,
}: {
  blob: Blob;
  mimeType: string | null;
  onRetry: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <p className="text-sm text-white/70">
        Opname klaar &mdash; {mimeType ?? "onbekend formaat"}, {(blob.size / 1024).toFixed(0)} KB
      </p>
      <audio controls src={url} className="w-full max-w-xs" />
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
