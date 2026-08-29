"use client";

import { useEffect, useState } from "react";
import { fetchIdleArtwork } from "@/lib/idle-art";

const CYCLE_MS = 7000;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Cycles through real, currently-charting album covers for the idle-screen
 * background. Falls back to `failed: true` (caller renders the gradient
 * instead) when offline or the feed can't be reached.
 */
export function useIdleArtwork() {
  const [urls, setUrls] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchIdleArtwork()
      .then((fetched) => {
        if (cancelled) return;
        if (fetched.length === 0) {
          setFailed(true);
          return;
        }
        setUrls(shuffle(fetched));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (urls.length < 2) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % urls.length);
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [urls.length]);

  return { url: urls[index], failed };
}
