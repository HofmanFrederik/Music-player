"use client";

import { useEffect, useState } from "react";

interface UseTrackTimerArgs {
  durationMs: number;
  /** ACRCloud's play_offset_ms — anchored to the END of the recorded
   *  fragment, not its start (a short recording, analyzed as one sample,
   *  reports where in the track that sample sits — treating that as the
   *  song's position at the moment recording stopped is the documented,
   *  practically-correct approximation). */
  playOffsetMs: number;
  /** Date.now() when MediaRecorder stopped. */
  recordedAt: number;
  /** Date.now() when the recognition response arrived. */
  respondedAt: number;
}

/**
 * Estimates live playback position — this app never controls the actual
 * music, so position is reconstructed from where ACRCloud placed us in the
 * track, corrected for how long the round trip to ACRCloud took:
 *
 *   startTime = Date.now() - play_offset_ms - networkLatency
 *   position  = Date.now() - startTime
 *
 * Skipping the network-latency term would leave the bar/lyrics
 * permanently behind by however long recognition took. Driven by
 * requestAnimationFrame, not setInterval, per spec.
 */
export function useTrackTimer({ durationMs, playOffsetMs, recordedAt, respondedAt }: UseTrackTimerArgs) {
  // Computed once per TrackView mount (args are stable for the lifetime of
  // a given match) via lazy useState init, not a ref, so it's safe to read
  // during render.
  const [startTimestamp] = useState(() => {
    const networkLatency = respondedAt - recordedAt;
    return respondedAt - playOffsetMs - networkLatency;
  });

  const [positionMs, setPositionMs] = useState(() => Date.now() - startTimestamp);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let frameId: number;

    const tick = () => {
      const position = Date.now() - startTimestamp;
      setPositionMs(position);

      if (position >= durationMs) {
        setFinished(true);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [durationMs, startTimestamp]);

  const progress = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  return { positionMs, progress, finished };
}
