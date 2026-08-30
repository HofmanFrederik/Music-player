import { NextRequest, NextResponse } from "next/server";
import { CreditsNotFoundError, fetchCredits } from "@/lib/discogs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const title = searchParams.get("title");
  const album = searchParams.get("album");

  if (!artist || !title) {
    return NextResponse.json({ error: "artist en title zijn verplicht." }, { status: 400 });
  }

  try {
    const credits = await fetchCredits(artist, title, album);
    return NextResponse.json(credits);
  } catch (error) {
    if (error instanceof CreditsNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Onverwachte fout bij /api/credits", error);
    return NextResponse.json({ error: "Onverwachte fout bij bezetting ophalen." }, { status: 500 });
  }
}
