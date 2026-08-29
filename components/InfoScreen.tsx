import { Music } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { ActionButtons } from "./ActionButtons";
import type { RecognitionResult } from "@/lib/types";

interface InfoScreenProps {
  result: RecognitionResult;
  onToggleLyrics: () => void;
  lyricsDisabled?: boolean;
  progress: number;
}

/**
 * Figma node 1:96 ("Background - album cover"). Positions measured from the
 * rendered 844x390 screenshot: album cover left 8.4% / top 107px, sized
 * ~172px; text column starts at left 33.5%, vertically centered against the
 * cover. The raw Figma export renders sideways outside Figma's own frame
 * rotation, so this is a from-scratch reproduction using those anchors
 * rather than a port of the exported markup.
 */
export function InfoScreen({ result, onToggleLyrics, lyricsDisabled, progress }: InfoScreenProps) {
  return (
    <div className="relative flex-1 w-full overflow-hidden">
      <BlurredBackground src={result.coverUrl ?? undefined} blurPx={72} />

      <div className="absolute left-[8.8%] top-1/2 flex -translate-y-1/2 items-center gap-6">
        <div className="relative h-[172px] w-[172px] shrink-0 overflow-hidden rounded-lg bg-white/20">
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
        </div>

        <div className="flex flex-col justify-center gap-3">
          <div>
            <p className="font-sans text-[32px] font-medium leading-tight tracking-tight text-white">
              {result.title}
            </p>
            <p className="font-sans text-[28px] font-medium leading-tight tracking-tight text-white/60">
              {result.artist}
            </p>
          </div>

          {result.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.genres.map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-white/20 px-[14px] py-[6px] text-[12px] font-medium text-white"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ActionButtons
        youtubeVideoId={result.youtubeVideoId}
        spotifyTrackId={result.spotifyTrackId}
        onToggleLyrics={onToggleLyrics}
        lyricsDisabled={lyricsDisabled}
        progress={progress}
      />
    </div>
  );
}
