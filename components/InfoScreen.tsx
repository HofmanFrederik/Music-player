"use client";

import { motion } from "framer-motion";
import { Music } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { ActionButtons } from "./ActionButtons";
import type { RecognitionResult } from "@/lib/types";

interface InfoScreenProps {
  result: RecognitionResult;
  onToggleLyrics: () => void;
  onShowAlbum: () => void;
  onShowSongInfo: () => void;
  onShowArtistInfo: () => void;
  lyricsDisabled?: boolean;
  progress: number;
  positionMs: number;
  onSkipPrevious?: () => void;
  onSkipNext?: () => void;
}

const textColumn = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const textItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

/**
 * Figma node 1:96 ("Background - album cover", landscape only), adapted
 * per user feedback after the initial pixel-measured build: cover+text row
 * is anchored at a fixed top-[80px] rather than vertically centered,
 * because centering pushed the cover into the bottom action bar once that
 * grew to three rows (icons row / bar / time labels). The raw Figma
 * export renders sideways outside Figma's own frame rotation, so this is
 * a from-scratch reproduction using measured anchors rather than a port
 * of the exported markup.
 *
 * Portrait has no Figma reference — cover and text stack vertically and
 * center instead of sitting side by side, which is the natural "now
 * playing" pattern once there's a tall column to work with instead of a
 * short wide one. Cover size and text sizes are fluid (`clamp(min, Nvmin,
 * max)`) so they scale across small phones through tablets instead of
 * only looking right at the two reference sizes. The cover is a tappable
 * button (not in Figma, user-requested) opening AlbumScreen — full album
 * details (year, tracklist, length) that ACRCloud itself doesn't return.
 */
export function InfoScreen({
  result,
  onToggleLyrics,
  onShowAlbum,
  onShowSongInfo,
  onShowArtistInfo,
  lyricsDisabled,
  progress,
  positionMs,
  onSkipPrevious,
  onSkipNext,
}: InfoScreenProps) {
  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={result.coverUrl ?? undefined} blurPx={72} />

      <div
        className="absolute left-[8.8%] right-[8.8%] flex
          landscape:top-[calc(clamp(46px,16.41vmin,86px)_+_env(safe-area-inset-top))] landscape:flex-row landscape:items-center landscape:gap-6
          portrait:top-[calc(clamp(55px,19.49vmin,103px)_+_env(safe-area-inset-top))] portrait:flex-col portrait:items-center portrait:gap-5 portrait:text-center"
      >
        <motion.button
          type="button"
          onClick={onShowAlbum}
          aria-label="Bekijk albuminfo"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative shrink-0 overflow-hidden rounded-lg bg-white/20 text-left transition-opacity hover:opacity-80 landscape:h-[clamp(124px,44.1vmin,232px)] landscape:w-[clamp(124px,44.1vmin,232px)] portrait:h-[clamp(158px,56.41vmin,297px)] portrait:w-[clamp(158px,56.41vmin,297px)]"
        >
          {result.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host (Deezer via ACRCloud), can't be enumerated in next.config
            <img
              src={result.coverUrl}
              alt={`${result.album ?? result.title} albumhoes`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music className="h-[35%] w-[35%] text-white/50" strokeWidth={1.5} />
            </div>
          )}
        </motion.button>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={textColumn}
          className="flex min-w-0 flex-col gap-3 landscape:flex-1 landscape:justify-center portrait:w-full portrait:items-center"
        >
          <div className="min-w-0 portrait:w-full">
            <motion.button
              type="button"
              onClick={onShowSongInfo}
              aria-label="Meer info over dit nummer"
              variants={textItem}
              className="block w-full truncate text-left font-sans text-[clamp(23px,8.21vmin,43px)] font-medium leading-tight tracking-tight text-white transition-opacity hover:opacity-80 portrait:text-center"
            >
              {result.title}
            </motion.button>
            <motion.button
              type="button"
              onClick={onShowArtistInfo}
              aria-label="Meer info over deze artiest"
              variants={textItem}
              className="block w-full truncate text-left font-sans text-[clamp(20px,7.18vmin,38px)] font-medium leading-tight tracking-tight text-white/60 transition-opacity hover:opacity-80 portrait:text-center"
            >
              {result.artist}
            </motion.button>
          </div>

          {result.genres.length > 0 && (
            <motion.div variants={textItem} className="flex flex-wrap gap-2 portrait:justify-center">
              {result.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/20 px-[14px] py-[6px] text-[clamp(9px,3.08vmin,16px)] font-medium text-white"
                >
                  {genre}
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      <ActionButtons
        youtubeVideoId={result.youtubeVideoId}
        spotifyTrackId={result.spotifyTrackId}
        onToggleLyrics={onToggleLyrics}
        lyricsDisabled={lyricsDisabled}
        progress={progress}
        timeLabels={{ positionMs, durationMs: result.durationMs }}
        onSkipPrevious={onSkipPrevious}
        onSkipNext={onSkipNext}
      />
    </div>
  );
}
