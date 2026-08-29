"use client";

import { ArrowLeft, Music, Trash2 } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { formatRelativeTime } from "@/lib/format";
import type { HistoryEntry } from "@/lib/history";

interface HistoryScreenProps {
  entries: HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
}

/**
 * Local-only recognition history (localStorage, see lib/history.ts) —
 * reachable from the idle screen. Not part of the Figma file; styled to
 * match the rest of the app (same gradient fallback, insets, type scale).
 */
export function HistoryScreen({ entries, onClose, onClear }: HistoryScreenProps) {
  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground />

      <div className="absolute left-[8.8%] right-[8.8%] top-[24px] flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Terug"
          className="flex items-center gap-2 text-white opacity-90 transition-opacity hover:opacity-70"
        >
          <ArrowLeft size={22} strokeWidth={2} />
          <span className="font-sans text-[16px] font-medium">Geschiedenis</span>
        </button>

        {entries.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Geschiedenis wissen"
            className="flex items-center gap-1.5 text-white/60 transition-opacity hover:opacity-70"
          >
            <Trash2 size={16} strokeWidth={2} />
            <span className="font-sans text-[12px] font-medium">Wissen</span>
          </button>
        )}
      </div>

      <div className="absolute left-[8.8%] right-[8.8%] top-[68px] bottom-[24px] overflow-y-auto">
        {entries.length === 0 ? (
          <p className="font-sans text-[14px] text-white/50">Nog geen nummers herkend.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => {
              const spotifyUrl = entry.spotifyTrackId
                ? `https://open.spotify.com/track/${entry.spotifyTrackId}`
                : null;
              const disabled = !spotifyUrl;

              return (
                <li key={`${entry.title}::${entry.artist}::${entry.recognizedAt}`}>
                  <a
                    href={spotifyUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Zoek ${entry.title} van ${entry.artist} op Spotify`}
                    aria-disabled={disabled}
                    onClick={(event) => {
                      if (disabled) event.preventDefault();
                    }}
                    className={`flex items-center gap-3 rounded-lg transition-opacity ${
                      disabled ? "cursor-not-allowed opacity-50" : "opacity-100 hover:opacity-70"
                    }`}
                  >
                    <div className="relative h-[40px] w-[40px] shrink-0 overflow-hidden rounded-md bg-white/10">
                      {entry.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, can't be enumerated in next.config
                        <img src={entry.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music className="text-white/40" size={18} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[15px] font-medium text-white">{entry.title}</p>
                      <p className="truncate font-sans text-[13px] text-white/60">{entry.artist}</p>
                    </div>
                    <span className="shrink-0 font-sans text-[11px] text-white/40">
                      {formatRelativeTime(entry.recognizedAt)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
