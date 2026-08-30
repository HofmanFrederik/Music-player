// Wikipedia's REST API asks integrators to identify themselves; also needed
// server-side since we already proxy every other external lookup this way.
const USER_AGENT = "MusicRecognizerPWA/1.0 (+https://en.wikipedia.org)";

export interface WikiSummary {
  title: string;
  extract: string;
  thumbnailUrl: string | null;
  pageUrl: string;
}

export class WikiNotFoundError extends Error {
  constructor() {
    super("Geen Wikipedia-info gevonden.");
    this.name = "WikiNotFoundError";
  }
}

interface SearchResponse {
  query?: { search?: { title: string }[] };
}

interface SummaryResponse {
  title?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function findPageTitle(query: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    srlimit: "1",
    origin: "*",
  });

  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`Wikipedia search antwoordde met status ${res.status}.`);

  const data: SearchResponse = await res.json();
  return data.query?.search?.[0]?.title ?? null;
}

/**
 * Real-content "more info" — not a search-results link like the Genius
 * button, but the actual Wikipedia summary shown in-app. Two calls: search
 * by free-text query to find the right page (song titles especially need
 * disambiguation, e.g. "Coming Up" -> "Coming Up (song)"), then fetch that
 * page's summary. No article for a given song/artist -> WikiNotFoundError,
 * which the caller shows as a normal "not available" state, not an error.
 */
export async function fetchWikipediaSummary(query: string): Promise<WikiSummary> {
  const title = await findPageTitle(query);
  if (!title) throw new WikiNotFoundError();

  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    { headers: { "User-Agent": USER_AGENT } }
  );
  if (res.status === 404) throw new WikiNotFoundError();
  if (!res.ok) throw new Error(`Wikipedia antwoordde met status ${res.status}.`);

  const data: SummaryResponse = await res.json();
  if (!data.extract) throw new WikiNotFoundError();

  return {
    title: data.title ?? title,
    extract: data.extract,
    thumbnailUrl: data.thumbnail?.source ?? null,
    pageUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}
