"use client";

import type { ReactNode } from "react";
import { CirclePlus, Quote, SkipBack, SkipForward, Video } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { formatElapsed, formatRemaining } from "@/lib/format";

export function ExternalIconLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  const disabled = !href;

  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      aria-disabled={disabled}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
      className={`flex shrink-0 items-center justify-center text-white transition-opacity ${
        disabled ? "opacity-30 cursor-not-allowed" : "opacity-100 hover:opacity-80"
      }`}
    >
      {children}
    </a>
  );
}

export function VideoButton({ youtubeVideoId }: { youtubeVideoId: string | null }) {
  const youtubeUrl = youtubeVideoId ? `https://youtube.com/watch?v=${youtubeVideoId}` : null;

  return (
    <ExternalIconLink href={youtubeUrl} label="Bekijk muziekvideo">
      <Video className="h-[clamp(20px,7.18vmin,38px)] w-[clamp(20px,7.18vmin,38px)]" strokeWidth={1.75} />
    </ExternalIconLink>
  );
}

interface BottomActionBarProps {
  spotifyTrackId: string | null;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  /** True while the Lyrics screen itself is showing, so the toggle icon renders filled. */
  lyricsActive?: boolean;
  progress: number;
  /** Elapsed/remaining labels below the bar — shown on both Info and Lyrics. */
  timeLabels?: { positionMs: number; durationMs: number } | null;
  /** Only present for a Spotify-sourced match — mic-recognized tracks aren't something this app actually controls playback of. */
  onSkipPrevious?: () => void;
  onSkipNext?: () => void;
}

export function BottomActionBar({
  spotifyTrackId,
  onToggleLyrics,
  lyricsDisabled = false,
  lyricsActive = false,
  progress,
  timeLabels = null,
  onSkipPrevious,
  onSkipNext,
}: BottomActionBarProps) {
  const spotifyUrl = spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : null;

  return (
    <div className="absolute left-[8.8%] right-[8.8%]
        landscape:bottom-[calc(clamp(14px,5.13vmin,27px)_+_env(safe-area-inset-bottom))]
        portrait:bottom-[calc(clamp(23px,8.21vmin,43px)_+_env(safe-area-inset-bottom))]">
      {/* Frosted-glass backdrop behind the whole icons/bar/labels cluster,
          so it stays legible over a busy or bright album cover — extends
          a bit past the content on every side rather than hugging it. */}
      <div className="absolute -inset-x-4 -inset-y-3 -z-10 rounded-2xl bg-black/25 backdrop-blur-xl" />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          {onSkipPrevious && (
            <button
              type="button"
              onClick={onSkipPrevious}
              aria-label="Vorig nummer"
              className="flex shrink-0 items-center justify-center text-white opacity-100 transition-opacity hover:opacity-80"
            >
              <SkipBack className="h-[clamp(20px,7.18vmin,38px)] w-[clamp(20px,7.18vmin,38px)]" strokeWidth={1.75} fill="currentColor" />
            </button>
          )}

          <ExternalIconLink href={spotifyUrl} label="Voeg toe aan Spotify">
            <CirclePlus className="h-[clamp(23px,8.21vmin,43px)] w-[clamp(23px,8.21vmin,43px)]" strokeWidth={1.5} />
          </ExternalIconLink>

          <button
            type="button"
            onClick={onToggleLyrics}
            disabled={lyricsDisabled}
            aria-label="Wissel tussen info en songtekst"
            className={`flex shrink-0 items-center justify-center text-white transition-opacity ${
              lyricsDisabled ? "opacity-30 cursor-not-allowed" : "opacity-100 hover:opacity-80"
            }`}
          >
            <Quote
              className="h-[clamp(20px,7.18vmin,38px)] w-[clamp(20px,7.18vmin,38px)]"
              strokeWidth={1.75}
              fill={lyricsActive ? "currentColor" : "none"}
            />
          </button>

          {onSkipNext && (
            <button
              type="button"
              onClick={onSkipNext}
              aria-label="Volgend nummer"
              className="flex shrink-0 items-center justify-center text-white opacity-100 transition-opacity hover:opacity-80"
            >
              <SkipForward className="h-[clamp(20px,7.18vmin,38px)] w-[clamp(20px,7.18vmin,38px)]" strokeWidth={1.75} fill="currentColor" />
            </button>
          )}
        </div>

        <ProgressBar progress={progress} />

        {timeLabels && (
          <div className="flex items-center justify-between font-sans text-[clamp(9px,3.08vmin,16px)] font-medium text-white">
            <span>{formatElapsed(timeLabels.positionMs)}</span>
            <span>{formatRemaining(timeLabels.positionMs, timeLabels.durationMs)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  youtubeVideoId: string | null;
  spotifyTrackId: string | null;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  progress: number;
  timeLabels?: { positionMs: number; durationMs: number } | null;
  onSkipPrevious?: () => void;
  onSkipNext?: () => void;
}

/**
 * The fixed UI shown once there's a match, shared by the Info and Lyrics
 * screens (Figma nodes 1:96 / 2:117, measured from their rendered
 * screenshots): video top-right. The bottom section stacks three rows —
 * add-to-Spotify / lyrics-toggle on their own row, then the full-width
 * progress bar, then elapsed/remaining time labels — shown on both screens
 * (per user direction: the icons shouldn't flank the bar). Missing ids
 * disable their button instead of hiding it, so the layout stays stable.
 * Skip previous/next only appear when onSkipPrevious/onSkipNext are
 * passed — a Spotify-sourced match only, since this app never controls
 * playback for a mic-recognized one.
 *
 * Info/Idle have nothing else up top, so the video button can sit fixed at
 * right-8.8%/top-31px. The Lyrics screen's mini-player header occupies
 * that corner, so it composes VideoButton inline in its own row instead of
 * using this combined component — see LyricsScreen.tsx.
 *
 * Top/bottom offsets add `env(safe-area-inset-*)` so the video button and
 * bottom bar never sit under a real device's status bar/notch or home
 * indicator — caught on a real phone in portrait, where the fixed offset
 * alone wasn't enough clearance.
 */
export function ActionButtons({
  youtubeVideoId,
  spotifyTrackId,
  onToggleLyrics,
  lyricsDisabled = false,
  progress,
  timeLabels = null,
  onSkipPrevious,
  onSkipNext,
}: ActionButtonsProps) {
  return (
    <>
      <div className="absolute right-[8.8%] top-[calc(clamp(22px,7.95vmin,42px)_+_env(safe-area-inset-top))]">
        <VideoButton youtubeVideoId={youtubeVideoId} />
      </div>

      <BottomActionBar
        spotifyTrackId={spotifyTrackId}
        onToggleLyrics={onToggleLyrics}
        lyricsDisabled={lyricsDisabled}
        progress={progress}
        timeLabels={timeLabels}
        onSkipPrevious={onSkipPrevious}
        onSkipNext={onSkipNext}
      />
    </>
  );
}
