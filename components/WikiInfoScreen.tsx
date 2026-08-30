"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { BASE_PATH } from "@/lib/base-path";
import type { WikiSummary } from "@/lib/wikipedia";

interface WikiInfoScreenProps {
  mode: "song" | "artist";
  artist: string;
  title: string;
  /** Currently playing track's cover — shown while the Wikipedia thumbnail loads, and as the fallback if there is none. */
  fallbackCoverUrl: string | null;
  onClose: () => void;
}

type WikiState =
  | { status: "loading" }
  | { status: "ready"; summary: WikiSummary }
  | { status: "unavailable" };

function useWikiSummary(mode: "song" | "artist", artist: string, title: string) {
  const [state, setState] = useState<WikiState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ mode, artist, ...(mode === "song" ? { title } : {}) });

    fetch(`${BASE_PATH}/api/wiki?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "unavailable" });
          return;
        }
        const summary: WikiSummary = await res.json();
        setState({ status: "ready", summary });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [mode, artist, title]);

  return state;
}

/**
 * Reachable by tapping the song title or artist name on Info/Lyrics — not
 * part of the Figma file. ACRCloud has no "about this song/artist" text of
 * its own, so this looks the page up on Wikipedia's free, keyless REST API
 * (see lib/wikipedia.ts) purely on demand, same pattern as AlbumScreen.
 * One component handles both song and artist lookups (`mode`) since they
 * only differ in the search query and heading, not the layout.
 */
export function WikiInfoScreen({ mode, artist, title, fallbackCoverUrl, onClose }: WikiInfoScreenProps) {
  const state = useWikiSummary(mode, artist, title);
  const summary = state.status === "ready" ? state.summary : null;
  const heading = mode === "song" ? title : artist;

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={summary?.thumbnailUrl ?? fallbackCoverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] right-[8.8%] top-[calc(clamp(17px,6.15vmin,32px)_+_env(safe-area-inset-top))] flex items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Terug"
          className="flex items-center gap-2 text-white opacity-90 transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-[clamp(16px,5.64vmin,30px)] w-[clamp(16px,5.64vmin,30px)]" strokeWidth={2} />
          <span className="font-sans text-[clamp(12px,4.1vmin,22px)] font-medium">
            {mode === "song" ? "Over dit nummer" : "Over de artiest"}
          </span>
        </button>
      </div>

      <div className="absolute left-[8.8%] right-[8.8%] top-[calc(clamp(49px,17.44vmin,92px)_+_env(safe-area-inset-top))] bottom-[calc(clamp(17px,6.15vmin,32px)_+_env(safe-area-inset-bottom))] overflow-y-auto">
        {state.status === "loading" && (
          <p className="font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">Info laden&hellip;</p>
        )}

        {state.status === "unavailable" && (
          <p className="font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">
            {mode === "song" ? "Geen info gevonden over dit nummer." : "Geen info gevonden over deze artiest."}
          </p>
        )}

        {summary && (
          <>
            <p className="truncate font-sans text-[clamp(15px,5.13vmin,27px)] font-medium leading-tight tracking-tight text-white">
              {heading}
            </p>

            {summary.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary Wikimedia host, can't be enumerated in next.config
              <img
                src={summary.thumbnailUrl}
                alt=""
                className="mt-3 h-[clamp(90px,32vmin,168px)] w-[clamp(90px,32vmin,168px)] rounded-lg object-cover"
              />
            )}

            <p className="mt-3 font-sans text-[clamp(12px,4.1vmin,22px)] font-medium leading-relaxed text-white/80 whitespace-pre-line">
              {summary.extract}
            </p>

            <a
              href={summary.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 font-sans text-[clamp(10px,3.59vmin,19px)] font-medium text-white/50 transition-opacity hover:opacity-70"
            >
              Lees meer op Wikipedia
              <ExternalLink className="h-[clamp(9px,3.08vmin,16px)] w-[clamp(9px,3.08vmin,16px)]" strokeWidth={2} />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
