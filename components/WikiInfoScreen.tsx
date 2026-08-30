"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { BASE_PATH } from "@/lib/base-path";
import type { WikiSummary } from "@/lib/wikipedia";
import type { SongCredits } from "@/lib/discogs";

interface WikiInfoScreenProps {
  mode: "song" | "artist";
  artist: string;
  title: string;
  album: string | null;
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

// Credits are only meaningful for the song, not the artist — `enabled`
// keeps this a no-op for mode="artist" without breaking the rules of
// hooks by calling it conditionally. Failures/no-match stay silent (no
// unavailable state rendered) since this is a bonus section under the
// Wikipedia extract, not the screen's main purpose.
function useCredits(enabled: boolean, artist: string, title: string, album: string | null) {
  const [credits, setCredits] = useState<SongCredits | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const params = new URLSearchParams({ artist, title, ...(album ? { album } : {}) });

    fetch(`${BASE_PATH}/api/credits?${params.toString()}`)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data: SongCredits = await res.json();
        if (!cancelled) setCredits(data);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [enabled, artist, title, album]);

  return credits;
}

/**
 * Reachable by tapping the song title or artist name on Info/Lyrics — not
 * part of the Figma file. ACRCloud has no "about this song/artist" text of
 * its own, so this looks the page up on Wikipedia's free, keyless REST API
 * (see lib/wikipedia.ts) purely on demand, same pattern as AlbumScreen.
 * One component handles both song and artist lookups (`mode`) since they
 * only differ in the search query and heading, not the layout. Song mode
 * additionally shows a "Credits" section (who worked on it, which
 * instruments they played) sourced from Discogs — see lib/discogs.ts for
 * why Discogs rather than MusicBrainz.
 */
export function WikiInfoScreen({ mode, artist, title, album, fallbackCoverUrl, onClose }: WikiInfoScreenProps) {
  const state = useWikiSummary(mode, artist, title);
  const summary = state.status === "ready" ? state.summary : null;
  const credits = useCredits(mode === "song", artist, title, album);
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

        {credits && credits.entries.length > 0 && (
          <div className="mt-5 flex flex-col gap-2.5">
            <p className="font-sans text-[clamp(9px,3.08vmin,16px)] font-semibold uppercase tracking-wide text-white/40">
              Credits
            </p>
            {credits.entries.map((entry) => (
              <div key={entry.name} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate font-sans text-[clamp(11px,3.85vmin,20px)] font-medium text-white">
                  {entry.name}
                </span>
                <span className="max-w-[55%] text-right font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">
                  {entry.roles.join(", ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
