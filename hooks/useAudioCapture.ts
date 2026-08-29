"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AudioCaptureStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "stopped"
  | "error";

const RECORD_MS = 5000;

// Ordered by preference. iOS Safari only supports audio/mp4 — webm/opus is
// preferred everywhere else for smaller payloads.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

interface AudioCaptureState {
  status: AudioCaptureStatus;
  blob: Blob | null;
  mimeType: string | null;
  error: string | null;
  /** Date.now() at the moment recording stopped — the reference point for
   *  network-latency correction once the recognition response comes back. */
  recordedAt: number | null;
}

const initialState: AudioCaptureState = {
  status: "idle",
  blob: null,
  mimeType: null,
  error: null,
  recordedAt: null,
};

export function useAudioCapture() {
  const [state, setState] = useState<AudioCaptureState>(initialState);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  const start = useCallback(async () => {
    setState((prev) => {
      if (prev.status === "requesting-permission" || prev.status === "recording") {
        return prev;
      }
      return { ...initialState, status: "requesting-permission" };
    });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState({
        ...initialState,
        status: "error",
        error: "Microfoontoegang geweigerd of niet beschikbaar.",
      });
      return;
    }

    streamRef.current = stream;
    const mimeType = pickSupportedMimeType();

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      releaseStream();
      setState({
        ...initialState,
        status: "error",
        error: "Opnemen wordt niet ondersteund op dit toestel.",
      });
      return;
    }

    recorderRef.current = recorder;
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      const recordedAt = Date.now();
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      releaseStream();
      setState({
        status: "stopped",
        blob,
        mimeType: recorder.mimeType || mimeType || null,
        error: null,
        recordedAt,
      });
    };

    recorder.start();
    setState((prev) => ({ ...prev, status: "recording" }));

    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, RECORD_MS);
  }, [releaseStream]);

  const reset = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    releaseStream();
    recorderRef.current = null;
    setState(initialState);
  }, [releaseStream]);

  return { ...state, start, reset };
}
