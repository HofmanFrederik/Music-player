import { NextRequest, NextResponse } from "next/server";
import { WikiNotFoundError, fetchWikipediaSummary } from "@/lib/wikipedia";

// Catalog names (from iTunes, or ACRCloud track titles) often carry an
// edition/version suffix — "McCartney II (Archive Collection)", "Song Name
// (Remastered 2009)" — that real Wikipedia article text never contains
// verbatim. Quoting the exact name is what makes the search precise (see
// query construction below), so that suffix has to go first or the quoted
// phrase matches nothing and search falls back to much worse results.
function stripEditionSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const artist = searchParams.get("artist");
  const title = searchParams.get("title");
  const album = searchParams.get("album");

  const validMode = mode === "song" || mode === "artist" || mode === "album";
  if (!validMode || !artist || (mode === "song" && !title) || (mode === "album" && !album)) {
    return NextResponse.json(
      { error: "mode, artist (en title voor mode=song, album voor mode=album) zijn verplicht." },
      { status: 400 }
    );
  }

  // Quoting the exact title/album name as an exact phrase is what reliably
  // surfaces the right page over broader matches like an artist's
  // discography — verified against Wikipedia's live search for several
  // songs/albums (unquoted queries mis-ranked "McCartney II" behind "Paul
  // McCartney discography", for example; quoted, it came out on top).
  const query =
    mode === "song"
      ? `"${stripEditionSuffix(title!)}" ${artist} song`
      : mode === "album"
        ? `"${stripEditionSuffix(album!)}" album ${artist}`
        : artist;

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
