export interface AlbumTrack {
  trackNumber: number;
  name: string;
  durationMs: number;
}

export interface AlbumInfo {
  albumName: string;
  artistName: string;
  releaseYear: number | null;
  totalDurationMs: number;
  artworkUrl: string | null;
  tracks: AlbumTrack[];
}

export class AlbumNotFoundError extends Error {
  constructor() {
    super("Geen albuminfo gevonden.");
    this.name = "AlbumNotFoundError";
  }
}

interface ITunesResult {
  wrapperType?: string;
  kind?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  releaseDate?: string;
  artworkUrl100?: string;
  trackName?: string;
  trackNumber?: number;
  trackTimeMillis?: number;
}

interface ITunesResponse {
  results?: ITunesResult[];
}

function upscale(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}x${size}bb.$1`);
}

/**
 * Looks up full album details (year, tracklist, total length) on Apple's
 * free/keyless iTunes Search+Lookup APIs, since ACRCloud only returns
 * metadata about the matched track, not the album it's on. Two calls:
 * search-by-track to find the album's collectionId, then lookup(id) to
 * get every track on it.
 */
export async function fetchAlbumInfo(artist: string, title: string): Promise<AlbumInfo> {
  const searchParams = new URLSearchParams({
    term: `${artist} ${title}`,
    entity: "song",
    limit: "1",
  });

  const searchRes = await fetch(`https://itunes.apple.com/search?${searchParams}`);
  if (!searchRes.ok) {
    throw new Error(`iTunes search antwoordde met status ${searchRes.status}.`);
  }
  const searchData: ITunesResponse = await searchRes.json();
  const collectionId = searchData.results?.[0]?.collectionId;
  if (!collectionId) {
    throw new AlbumNotFoundError();
  }

  const lookupParams = new URLSearchParams({ id: String(collectionId), entity: "song" });
  const lookupRes = await fetch(`https://itunes.apple.com/lookup?${lookupParams}`);
  if (!lookupRes.ok) {
    throw new Error(`iTunes lookup antwoordde met status ${lookupRes.status}.`);
  }
  const lookupData: ITunesResponse = await lookupRes.json();
  const results = lookupData.results ?? [];

  const collection = results.find((r) => r.wrapperType === "collection");
  const tracks: AlbumTrack[] = results
    .filter((r) => r.wrapperType === "track" && r.kind === "song")
    .map((r) => ({
      trackNumber: r.trackNumber ?? 0,
      name: r.trackName ?? "Onbekend nummer",
      durationMs: r.trackTimeMillis ?? 0,
    }))
    .sort((a, b) => a.trackNumber - b.trackNumber);

  if (!collection || tracks.length === 0) {
    throw new AlbumNotFoundError();
  }

  const totalDurationMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const releaseYear = collection.releaseDate ? new Date(collection.releaseDate).getFullYear() : null;

  return {
    albumName: collection.collectionName ?? title,
    artistName: collection.artistName ?? artist,
    releaseYear,
    totalDurationMs,
    artworkUrl: collection.artworkUrl100 ? upscale(collection.artworkUrl100) : null,
    tracks,
  };
}
