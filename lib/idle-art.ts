interface ITunesRssImage {
  label: string;
}

interface ITunesRssEntry {
  "im:image"?: ITunesRssImage[];
}

interface ITunesRssResponse {
  feed?: {
    entry?: ITunesRssEntry[];
  };
}

const TOP_ALBUMS_FEED = "https://itunes.apple.com/us/rss/topalbums/limit=50/json";

function upscale(url: string, size = 600): string {
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}x${size}bb.$1`);
}

/**
 * Real, currently-charting album covers from Apple's public iTunes RSS feed
 * (no API key, CORS-enabled). Used only as decorative idle-screen background —
 * unrelated to the actual recognition result.
 */
export async function fetchIdleArtwork(): Promise<string[]> {
  const res = await fetch(TOP_ALBUMS_FEED, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`iTunes RSS feed responded with ${res.status}`);
  }

  const data: ITunesRssResponse = await res.json();
  const entries = data.feed?.entry ?? [];

  const urls = entries
    .map((entry) => {
      const images = entry["im:image"];
      const largest = images?.[images.length - 1];
      return largest ? upscale(largest.label) : null;
    })
    .filter((url): url is string => Boolean(url));

  return Array.from(new Set(urls));
}
