"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";
import type { LyricLine } from "@/lib/types";

export type LyricsState =
  | { status: "loading" }
  | { status: "ready"; syncedLines: LyricLine[] | null; plainLyrics: string | null }
  | { status: "unavailable" };

export function useLyrics(artist: string, title: string, durationMs: number): LyricsState {
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
