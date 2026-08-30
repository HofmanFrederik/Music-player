import { NextRequest, NextResponse } from "next/server";
import { AlbumNotFoundError, fetchAlbumInfo } from "@/lib/album";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get("artist");
  const title = searchParams.get("title");

  if (!artist || !title) {
    return NextResponse.json({ error: "artist en title zijn verplicht." }, { status: 400 });
  }

  try {
    const album = await fetchAlbumInfo(artist, title);
    return NextResponse.json(album);
  } catch (error) {
    if (error instanceof AlbumNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Onverwachte fout bij /api/album", error);
    return NextResponse.json({ error: "Onverwachte fout bij albuminfo ophalen." }, { status: 500 });
  }
}
