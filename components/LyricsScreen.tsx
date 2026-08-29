import { Music } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { BottomActionBar, VideoButton } from "./ActionButtons";
import { useSyncedLyrics } from "@/hooks/useSyncedLyrics";
import type { LyricLine, RecognitionResult } from "@/lib/types";

interface LyricsScreenProps {
  result: RecognitionResult;
  positionMs: number;
  syncedLines: LyricLine[] | null;
  plainLyrics: string | null;
  onToggleInfo: () => void;
  progress: number;
}

/**
 * Figma node 2:117. Same fixed chrome as InfoScreen, but with a compact
 * mini-player header (small cover + title + artist + video icon, all one
 * row) in place of the big cover, and three lyric lines below it —
 * measured left inset matches every other screen (~8.8%). Falls back to
 * plain, unhighlighted lyrics when there's no line-level sync (see spec:
 * instrumental or lrclib 404 -> plainLyrics without highlight).
 */
export function LyricsScreen({
  result,
  positionMs,
  syncedLines,
  plainLyrics,
  onToggleInfo,
  progress,
}: LyricsScreenProps) {
  const synced = useSyncedLyrics(syncedLines ?? [], positionMs);
  const hasSynced = Boolean(syncedLines && syncedLines.length > 0);

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={result.coverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] right-[8.8%] top-[24px] flex items-center gap-4">
        <div className="relative h-[31px] w-[31px] shrink-0 overflow-hidden rounded-md bg-white/20">
          {result.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host (Deezer via ACRCloud), can't be enumerated in next.config
            <img
              src={result.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="text-white/50" size={16} strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <p className="truncate font-sans text-[20px] font-medium leading-tight tracking-tight text-white">
            {result.title}
          </p>
          <p className="truncate font-sans text-[16px] font-medium leading-tight tracking-tight text-white/60">
            {result.artist}
          </p>
        </div>
        <VideoButton youtubeVideoId={result.youtubeVideoId} />
      </div>

      <div className="absolute left-[8.8%] top-[100px] right-[8.8%] flex flex-col gap-2">
        {hasSynced ? (
          <>
            <p className="font-sans text-[29px] font-medium leading-snug tracking-tight text-white/40">
              {synced.previous ?? ""}
            </p>
            <p className="font-sans text-[39px] font-bold leading-tight tracking-tight text-white">
              {synced.active ?? ""}
            </p>
            <p className="font-sans text-[29px] font-medium leading-snug tracking-tight text-white/60">
              {synced.next ?? ""}
            </p>
          </>
        ) : (
          <p className="font-sans text-[18px] font-medium leading-relaxed text-white/80 whitespace-pre-line max-h-[220px] overflow-y-auto">
            {plainLyrics ?? "Geen songtekst beschikbaar."}
          </p>
        )}
      </div>

      <BottomActionBar
        spotifyTrackId={result.spotifyTrackId}
        onToggleLyrics={onToggleInfo}
        progress={progress}
      />
    </div>
  );
}
