"use client";

import type { ReactNode } from "react";
import { CirclePlus, Quote, Video } from "lucide-react";
import { ProgressBar } from "./ProgressBar";

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
      <Video size={28} strokeWidth={1.75} />
    </ExternalIconLink>
  );
}

interface BottomActionBarProps {
  spotifyTrackId: string | null;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  progress: number;
}

export function BottomActionBar({
  spotifyTrackId,
  onToggleLyrics,
  lyricsDisabled = false,
  progress,
}: BottomActionBarProps) {
  const spotifyUrl = spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : null;

  return (
    <div className="absolute bottom-[32px] left-[8.8%] right-[8.8%] flex items-center gap-4">
      <ExternalIconLink href={spotifyUrl} label="Voeg toe aan Spotify">
        <CirclePlus size={32} strokeWidth={1.5} />
      </ExternalIconLink>

      <ProgressBar progress={progress} className="flex-1" />

      <button
        type="button"
        onClick={onToggleLyrics}
        disabled={lyricsDisabled}
        aria-label="Wissel tussen info en songtekst"
        className={`flex shrink-0 items-center justify-center text-white transition-opacity ${
          lyricsDisabled ? "opacity-30 cursor-not-allowed" : "opacity-100 hover:opacity-80"
        }`}
      >
        <Quote size={28} strokeWidth={1.75} />
      </button>
    </div>
  );
}

interface ActionButtonsProps {
  youtubeVideoId: string | null;
  spotifyTrackId: string | null;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  progress: number;
}

/**
 * The fixed UI shown once there's a match, shared by the Info and Lyrics
 * screens (Figma nodes 1:96 / 2:117, measured from their rendered
 * screenshots): video top-left, add-to-Spotify + progress bar + lyrics
 * toggle along the bottom edge. Missing ids disable their button instead of
 * hiding it, so the layout stays stable.
 *
 * Info/Idle have nothing else up top, so the video button can sit fixed at
 * left-8.8%/top-31px. The Lyrics screen's mini-player header occupies that
 * same corner, so it composes VideoButton inline in its own row instead of
 * using this combined component — see LyricsScreen.tsx.
 */
export function ActionButtons({
  youtubeVideoId,
  spotifyTrackId,
  onToggleLyrics,
  lyricsDisabled = false,
  progress,
}: ActionButtonsProps) {
  return (
    <>
      <div className="absolute left-[8.8%] top-[31px]">
        <VideoButton youtubeVideoId={youtubeVideoId} />
      </div>

      <BottomActionBar
        spotifyTrackId={spotifyTrackId}
        onToggleLyrics={onToggleLyrics}
        lyricsDisabled={lyricsDisabled}
        progress={progress}
      />
    </>
  );
}
