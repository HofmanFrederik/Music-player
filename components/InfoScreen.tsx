"use client";

import { motion } from "framer-motion";
import { Music } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { ActionButtons } from "./ActionButtons";
import type { RecognitionResult } from "@/lib/types";

interface InfoScreenProps {
  result: RecognitionResult;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  progress: number;
  positionMs: number;
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
 * Figma node 1:96 ("Background - album cover"), adapted per user feedback
 * after the initial pixel-measured build: cover+text row is anchored at a
 * fixed top-[80px] rather than vertically centered, because centering
 * pushed the cover into the bottom action bar once that grew to three rows
 * (icons row / bar / time labels). The raw Figma export renders sideways
 * outside Figma's own frame rotation, so this is a from-scratch
 * reproduction using measured anchors rather than a port of the exported
 * markup.
 */
export function InfoScreen({
  result,
  onToggleLyrics,
  lyricsDisabled,
  progress,
  positionMs,
}: InfoScreenProps) {
  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={result.coverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] right-[8.8%] top-[80px] flex items-center gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative h-[172px] w-[172px] shrink-0 overflow-hidden rounded-lg bg-white/20"
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
              <Music className="text-white/50" size={40} strokeWidth={1.5} />
            </div>
          )}
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={textColumn}
          className="flex min-w-0 flex-1 flex-col justify-center gap-3"
        >
          <div className="min-w-0">
            <motion.p
              variants={textItem}
              className="truncate font-sans text-[32px] font-medium leading-tight tracking-tight text-white"
            >
              {result.title}
            </motion.p>
            <motion.p
              variants={textItem}
              className="truncate font-sans text-[28px] font-medium leading-tight tracking-tight text-white/60"
            >
              {result.artist}
            </motion.p>
          </div>

          {result.genres.length > 0 && (
            <motion.div variants={textItem} className="flex flex-wrap gap-2">
              {result.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/20 px-[14px] py-[6px] text-[12px] font-medium text-white"
                >
                  {genre}
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>

      <ActionButtons
        title={result.title}
        artist={result.artist}
        youtubeVideoId={result.youtubeVideoId}
        spotifyTrackId={result.spotifyTrackId}
        onToggleLyrics={onToggleLyrics}
        lyricsDisabled={lyricsDisabled}
        progress={progress}
        timeLabels={{ positionMs, durationMs: result.durationMs }}
      />
    </div>
  );
}
