import { NextRequest, NextResponse } from "next/server";
import { LyricsNotFoundError, fetchLyrics } from "@/lib/lrclib";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist_name");
  const title = searchParams.get("track_name");
  const duration = searchParams.get("duration");

  if (!artist || !title || !duration) {
    return NextResponse.json(
      { error: "artist_name, track_name en duration zijn verplicht." },
      { status: 400 }
    );
  }

  try {
    const lyrics = await fetchLyrics(artist, title, Number(duration));
    return NextResponse.json(lyrics);
  } catch (error) {
    if (error instanceof LyricsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Onverwachte fout bij /api/lyrics", error);
    return NextResponse.json({ error: "Onverwachte fout bij songtekst ophalen." }, { status: 500 });
  }
}
