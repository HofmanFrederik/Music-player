"use client";

import { useEffect, useRef } from "react";
import { useAudioCapture } from "./useAudioCapture";
import { BASE_PATH } from "@/lib/base-path";
import type { RecognitionResult } from "@/lib/types";

const NORMAL_CHECK_INTERVAL_MS = 15_000;
// Once the estimated track is nearly over, check much more often so the
// next song is caught within a few seconds of the change instead of
// waiting up to a full normal interval.
const NEAR_END_CHECK_INTERVAL_MS = 4_000;
const NEAR_END_THRESHOLD_MS = 20_000;

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
 * ignored and just tried again next check; only a confirmed, different
 * match triggers `onSongChanged`.
 *
 * `currentResult` and `onSongChanged` are expected to be stable for the
 * lifetime of one call site (the caller remounts fresh via `key` when the
 * match changes), so they're used directly as effect dependencies rather
 * than mirrored into refs. `remainingMs` changes every animation frame
 * though (driven by useTrackTimer), so it's mirrored into a ref instead —
 * the scheduling effect only reacts to `status` changes, but reads the
 * latest remaining time at that moment to pick the next delay.
 */
export function useBackgroundRecognition(
  currentResult: RecognitionResult,
  remainingMs: number,
  onSongChanged: (result: RecognitionResult, recordedAt: number, respondedAt: number) => void
) {
  const { status, blob, recordedAt, start, reset } = useAudioCapture();

  const remainingRef = useRef(remainingMs);
  useEffect(() => {
    remainingRef.current = remainingMs;
  }, [remainingMs]);

  useEffect(() => {
    if (status !== "idle") return;

    const delay =
      remainingRef.current <= NEAR_END_THRESHOLD_MS
        ? NEAR_END_CHECK_INTERVAL_MS
        : NORMAL_CHECK_INTERVAL_MS;
    const timer = setTimeout(start, delay);
    return () => clearTimeout(timer);
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
        // at the next check, not a user-facing error.
      })
      .finally(() => {
        if (!cancelled) reset();
      });

    return () => {
      cancelled = true;
    };
  }, [status, blob, recordedAt, reset, currentResult, onSongChanged]);
}
