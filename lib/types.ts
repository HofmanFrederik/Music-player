export interface RecognitionResult {
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  genres: string[];
  durationMs: number;
  playOffsetMs: number;
  youtubeVideoId: string | null;
  spotifyTrackId: string | null;
}

export interface LyricLine {
  timeMs: number;
  text: string;
}
