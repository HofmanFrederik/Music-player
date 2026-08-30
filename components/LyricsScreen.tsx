import { AnimatePresence, motion } from "framer-motion";
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
  onShowAlbum: () => void;
  onShowSongInfo: () => void;
  onShowArtistInfo: () => void;
  progress: number;
}

/**
 * Figma node 2:117. Same fixed chrome as InfoScreen, but with a compact
 * mini-player header (small cover + title + artist + video icon, all one
 * row) in place of the big cover, and three lyric lines below it —
 * measured left inset matches every other screen (~8.8%). Falls back to
 * plain, unhighlighted lyrics when there's no line-level sync (see spec:
 * instrumental or lrclib 404 -> plainLyrics without highlight). All text
 * and the mini cover use fluid `clamp(min, Nvmin, max)` sizing so they
 * scale across small phones through tablets, not just the reference size.
 */
export function LyricsScreen({
  result,
  positionMs,
  syncedLines,
  plainLyrics,
  onToggleInfo,
  onShowAlbum,
  onShowSongInfo,
  onShowArtistInfo,
  progress,
}: LyricsScreenProps) {
  const synced = useSyncedLyrics(syncedLines ?? [], positionMs);
  const hasSynced = Boolean(syncedLines && syncedLines.length > 0);

  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={result.coverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] right-[8.8%] top-[calc(clamp(17px,6.15vmin,32px)_+_env(safe-area-inset-top))] flex items-center gap-4">
        <button
          type="button"
          onClick={onShowAlbum}
          aria-label="Bekijk albuminfo"
          className="relative h-[clamp(22px,7.95vmin,42px)] w-[clamp(22px,7.95vmin,42px)] shrink-0 overflow-hidden rounded-md bg-white/20 transition-opacity hover:opacity-80"
        >
          {result.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host (Deezer via ACRCloud), can't be enumerated in next.config
            <img
              src={result.coverUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-[45%] w-[45%] text-white/50" strokeWidth={1.5} />
            </div>
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <button
            type="button"
            onClick={onShowSongInfo}
            aria-label="Meer info over dit nummer"
            className="truncate font-sans text-[clamp(14px,5.13vmin,27px)] font-medium leading-tight tracking-tight text-white transition-opacity hover:opacity-80"
          >
            {result.title}
          </button>
          <button
            type="button"
            onClick={onShowArtistInfo}
            aria-label="Meer info over deze artiest"
            className="truncate font-sans text-[clamp(12px,4.1vmin,22px)] font-medium leading-tight tracking-tight text-white/60 transition-opacity hover:opacity-80"
          >
            {result.artist}
          </button>
        </div>
        <VideoButton youtubeVideoId={result.youtubeVideoId} />
      </div>

      <div
        className="absolute left-[8.8%] right-[8.8%] flex flex-col gap-2 overflow-hidden
          landscape:top-[calc(clamp(72px,25.64vmin,135px)_+_env(safe-area-inset-top))]
          portrait:top-[calc(clamp(209px,73.85vmin,389px)_+_env(safe-area-inset-top))]"
      >
        {hasSynced ? (
          <>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={`prev-${synced.previous ?? ""}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="font-sans text-[clamp(16px,5.64vmin,30px)] font-medium leading-snug tracking-tight text-white/40"
              >
                {synced.previous ?? ""}
              </motion.p>
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={`active-${synced.active ?? ""}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="font-sans text-[clamp(28px,10vmin,53px)] font-bold leading-tight tracking-tight text-white"
              >
                {synced.active ?? ""}
              </motion.p>
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={`next-${synced.next ?? ""}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="font-sans text-[clamp(21px,7.44vmin,39px)] font-medium leading-snug tracking-tight text-white/60"
              >
                {synced.next ?? ""}
              </motion.p>
            </AnimatePresence>
          </>
        ) : (
          <p className="font-sans text-[clamp(13px,4.62vmin,24px)] font-medium leading-relaxed text-white/80 whitespace-pre-line max-h-[220px] overflow-y-auto">
            {plainLyrics ?? "Geen songtekst beschikbaar."}
          </p>
        )}
      </div>

      {/* Progressively blurs lyric lines that grow long enough to reach the
          bottom controls (fades from no blur to full blur going down), so
          overflowing text softens into the bar instead of clashing under
          it. Sits between the lyrics text and BottomActionBar in DOM order
          so it paints over the text but under the bar's own controls. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[clamp(122px,43.59vmin,230px)] backdrop-blur-xl"
        style={{
          maskImage: "linear-gradient(to bottom, transparent, black 65%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 65%)",
        }}
      />

      <BottomActionBar
        title={result.title}
        artist={result.artist}
        spotifyTrackId={result.spotifyTrackId}
        onToggleLyrics={onToggleInfo}
        lyricsActive
        progress={progress}
        timeLabels={{ positionMs, durationMs: result.durationMs }}
      />
    </div>
  );
}
