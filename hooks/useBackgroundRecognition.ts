"use client";

import { useEffect } from "react";
import { useAudioCapture } from "./useAudioCapture";
import { BASE_PATH } from "@/lib/base-path";
import type { RecognitionResult } from "@/lib/types";

const CHECK_INTERVAL_MS = 15_000;

function sameTrack(a: RecognitionResult, b: RecognitionResult): boolean {
  return (
    a.title.trim().toLowerCase() === b.title.trim().toLowerCase() &&
    a.artist.trim().toLowerCase() === b.artist.trim().toLowerCase()
  );
}

/**
 * While a match is on screen, periodically records a short sample in the
 * background and re-checks it against ACRCloud — silently, without
 * touching the visible UI (no loading state, no idle flash) — so a song
 * change (skip, next track starting) is caught instead of waiting for the
 * estimated duration timer to run out. A no-match or transient error is
 * ignored and just tried again next interval; only a confirmed, different
 * match triggers `onSongChanged`.
 *
 * `currentResult` and `onSongChanged` are expected to be stable for the
 * lifetime of one call site (the caller remounts fresh via `key` when the
 * match changes), so they're used directly as effect dependencies rather
 * than mirrored into refs.
 */
export function useBackgroundRecognition(
  currentResult: RecognitionResult,
  onSongChanged: (result: RecognitionResult, recordedAt: number, respondedAt: number) => void
) {
  const { status, blob, recordedAt, start, reset } = useAudioCapture();

  useEffect(() => {
    const interval = setInterval(() => {
      if (status === "idle") start();
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, start]);

  useEffect(() => {
    if (status !== "stopped" || !blob || !recordedAt) return;

    let cancelled = false;
    const formData = new FormData();
    formData.append("audio", blob, "sample");

    fetch(`${BASE_PATH}/api/recognise`, { method: "POST", body: formData })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const result: RecognitionResult = await res.json();
        if (!sameTrack(result, currentResult)) {
          onSongChanged(result, recordedAt, Date.now());
        }
      })
      .catch(() => {
        // Silent by design — a transient failure just means we try again
        // at the next interval, not a user-facing error.
      })
      .finally(() => {
        if (!cancelled) reset();
      });

    return () => {
      cancelled = true;
    };
  }, [status, blob, recordedAt, reset, currentResult, onSongChanged]);
}
