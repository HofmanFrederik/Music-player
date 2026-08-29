interface ITunesSearchResult {
  artworkUrl100?: string;
}

interface ITunesSearchResponse {
  results?: ITunesSearchResult[];
}

function upscale(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}x${size}bb.$1`);
}

/**
 * ACRCloud only returns cover art when it happens to have Deezer metadata
 * linked for a match, which isn't always the case. Falls back to Apple's
 * free/keyless iTunes Search API, looked up by the recognized title+artist,
 * so a match still gets a real cover instead of none.
 */
export async function fetchCoverArtFallback(
  artist: string,
  title: string
): Promise<string | null> {
  const term = encodeURIComponent(`${artist} ${title}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data: ITunesSearchResponse = await res.json();
    const artwork = data.results?.[0]?.artworkUrl100;
    return artwork ? upscale(artwork) : null;
  } catch {
    return null;
  }
}
