"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { BASE_PATH } from "@/lib/base-path";
import { formatDuration, formatElapsed } from "@/lib/format";
import type { AlbumInfo } from "@/lib/album";

interface AlbumScreenProps {
  artist: string;
  title: string;
  /** Currently playing track's cover — shown while the album's own artwork loads, and as the fallback if the lookup fails. */
  fallbackCoverUrl: string | null;
  onClose: () => void;
}

type AlbumState =
  | { status: "loading" }
  | { status: "ready"; album: AlbumInfo }
  | { status: "unavailable" };

function useAlbumInfo(artist: string, title: string) {
  const [state, setState] = useState<AlbumState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ artist, title });

    fetch(`${BASE_PATH}/api/album?${params.toString()}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setState({ status: "unavailable" });
          return;
        }
        const album: AlbumInfo = await res.json();
        setState({ status: "ready", album });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [artist, title]);

  return state;
}

/**
 * Reachable by tapping the album cover on Info/Lyrics — not part of the
 * Figma file. ACRCloud only tells us about the matched track, not the
 * album it's on, so this looks the album up on Apple's free iTunes
 * Search+Lookup APIs (see lib/album.ts) purely on demand, not fetched
 * eagerly like lyrics. Styled to match HistoryScreen (same gradient
 * fallback, insets, fluid type scale, safe-area-aware edges).
 */
export function AlbumScreen({ artist, title, fallbackCoverUrl, onClose }: AlbumScreenProps) {
  const state = useAlbumInfo(artist, title);
  const album = state.status === "ready" ? state.album : null;

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={album?.artworkUrl ?? fallbackCoverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] right-[8.8%] top-[calc(clamp(17px,6.15vmin,32px)_+_env(safe-area-inset-top))] flex items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Terug"
          className="flex items-center gap-2 text-white opacity-90 transition-opacity hover:opacity-70"
        >
          <ArrowLeft className="h-[clamp(16px,5.64vmin,30px)] w-[clamp(16px,5.64vmin,30px)]" strokeWidth={2} />
          <span className="font-sans text-[clamp(12px,4.1vmin,22px)] font-medium">Album</span>
        </button>
      </div>

      <div className="absolute left-[8.8%] right-[8.8%] top-[calc(clamp(49px,17.44vmin,92px)_+_env(safe-area-inset-top))] bottom-[calc(clamp(17px,6.15vmin,32px)_+_env(safe-area-inset-bottom))] overflow-y-auto">
        {state.status === "loading" && (
          <p className="font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">Albuminfo laden&hellip;</p>
        )}

        {state.status === "unavailable" && (
          <p className="font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">
            Geen albuminfo gevonden voor dit nummer.
          </p>
        )}

        {album && (
          <>
            <p className="truncate font-sans text-[clamp(15px,5.13vmin,27px)] font-medium leading-tight tracking-tight text-white">
              {album.albumName}
            </p>
            <p className="truncate font-sans text-[clamp(12px,4.1vmin,22px)] font-medium leading-tight tracking-tight text-white/60">
              {album.artistName}
            </p>
            <p className="mt-1 font-sans text-[clamp(10px,3.59vmin,19px)] text-white/50">
              {[album.releaseYear, `${album.tracks.length} nummers`, formatDuration(album.totalDurationMs)]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <ul className="mt-4 flex flex-col gap-2.5">
              {album.tracks.map((track) => {
                const active = track.name.trim().toLowerCase() === title.trim().toLowerCase();
                return (
                  <li
                    key={`${track.trackNumber}-${track.name}`}
                    className={`flex items-center gap-3 ${active ? "text-white" : "text-white/70"}`}
                  >
                    <span className="w-[2ch] shrink-0 text-right font-sans text-[clamp(10px,3.59vmin,19px)] tabular-nums text-white/40">
                      {track.trackNumber}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate font-sans text-[clamp(11px,3.85vmin,20px)] ${active ? "font-semibold" : "font-medium"}`}
                    >
                      {track.name}
                    </span>
                    <span className="shrink-0 font-sans text-[clamp(9px,3.33vmin,18px)] tabular-nums text-white/40">
                      {formatElapsed(track.durationMs)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
