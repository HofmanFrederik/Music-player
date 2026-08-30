import { NextRequest, NextResponse } from "next/server";
import { WikiNotFoundError, fetchWikipediaSummary } from "@/lib/wikipedia";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const artist = searchParams.get("artist");
  const title = searchParams.get("title");

  if ((mode !== "song" && mode !== "artist") || !artist || (mode === "song" && !title)) {
    return NextResponse.json({ error: "mode, artist (en title voor mode=song) zijn verplicht." }, { status: 400 });
  }

  const query = mode === "song" ? `${title} ${artist} song` : artist;

  try {
    const summary = await fetchWikipediaSummary(query);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof WikiNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Onverwachte fout bij /api/wiki", error);
    return NextResponse.json({ error: "Onverwachte fout bij Wikipedia-info ophalen." }, { status: 500 });
  }
}
