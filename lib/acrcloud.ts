import crypto from "node:crypto";
import { fetchCoverArtFallback } from "./cover-art";
import type { RecognitionResult } from "./types";

const HTTP_METHOD = "POST";
const HTTP_URI = "/v1/identify";
const DATA_TYPE = "audio";
const SIGNATURE_VERSION = "1";

export class NoMatchError extends Error {
  constructor() {
    super("Geen match gevonden voor dit fragment.");
    this.name = "NoMatchError";
  }
}

export class AcrCloudRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcrCloudRequestError";
  }
}

interface AcrCloudConfig {
  accessKey: string;
  accessSecret: string;
  host: string;
}

function getConfig(): AcrCloudConfig {
  const accessKey = process.env.ACR_ACCESS_KEY;
  const accessSecret = process.env.ACR_ACCESS_SECRET;
  const host = process.env.ACR_HOST;

  if (!accessKey || !accessSecret || !host) {
    throw new AcrCloudRequestError(
      "ACRCloud omgevingsvariabelen ontbreken. Vul ACR_ACCESS_KEY, ACR_ACCESS_SECRET en ACR_HOST in .env.local in."
    );
  }

  return { accessKey, accessSecret, host };
}

function sign(config: AcrCloudConfig, timestamp: string): string {
  const stringToSign = [
    HTTP_METHOD,
    HTTP_URI,
    config.accessKey,
    DATA_TYPE,
    SIGNATURE_VERSION,
    timestamp,
  ].join("\n");

  return crypto
    .createHmac("sha1", config.accessSecret)
    .update(stringToSign)
    .digest("base64");
}

// Subset of the ACRCloud /v1/identify response shape that we actually read.
interface AcrCloudIdentifyResponse {
  status: {
    code: number;
    msg: string;
  };
  metadata?: {
    music?: AcrCloudMusicMatch[];
  };
}

interface AcrCloudMusicMatch {
  title: string;
  artists?: { name: string }[];
  album?: { name: string };
  genres?: { name: string }[];
  duration_ms?: number;
  play_offset_ms?: number;
  external_metadata?: {
    youtube?: { vid?: string };
    spotify?: { track?: { id?: string } };
    deezer?: {
      album?: {
        cover?: string;
        cover_medium?: string;
        cover_big?: string;
        cover_xl?: string;
      };
    };
  };
}

function normalize(match: AcrCloudMusicMatch): RecognitionResult {
  const deezerAlbum = match.external_metadata?.deezer?.album;
  const coverUrl =
    deezerAlbum?.cover_xl ??
    deezerAlbum?.cover_big ??
    deezerAlbum?.cover_medium ??
    deezerAlbum?.cover ??
    null;

  return {
    title: match.title,
    artist: match.artists?.map((a) => a.name).join(", ") || "Onbekende artiest",
    album: match.album?.name ?? null,
    coverUrl,
    genres: match.genres?.map((g) => g.name) ?? [],
    durationMs: match.duration_ms ?? 0,
    playOffsetMs: match.play_offset_ms ?? 0,
    youtubeVideoId: match.external_metadata?.youtube?.vid ?? null,
    spotifyTrackId: match.external_metadata?.spotify?.track?.id ?? null,
  };
}

/**
 * Signs and sends the recorded sample to ACRCloud's /v1/identify, and
 * returns a normalized RecognitionResult. Never returns or logs the raw
 * ACRCloud response body. Server-side only — needs `access_secret`.
 */
export async function identifyAudio(sample: Blob): Promise<RecognitionResult> {
  const config = getConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(config, timestamp);

  const form = new FormData();
  form.append("access_key", config.accessKey);
  form.append("sample", sample, "sample");
  form.append("sample_bytes", String(sample.size));
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("data_type", DATA_TYPE);
  form.append("signature_version", SIGNATURE_VERSION);

  let response: Response;
  try {
    response = await fetch(`https://${config.host}${HTTP_URI}`, {
      method: HTTP_METHOD,
      body: form,
    });
  } catch {
    throw new AcrCloudRequestError("Geen verbinding met ACRCloud (controleer je internetverbinding).");
  }

  if (!response.ok) {
    throw new AcrCloudRequestError(`ACRCloud antwoordde met status ${response.status}.`);
  }

  const data: AcrCloudIdentifyResponse = await response.json();

  if (data.status.code !== 0) {
    // 1001 = "No result" in ACRCloud's status codes.
    if (data.status.code === 1001) {
      throw new NoMatchError();
    }
    throw new AcrCloudRequestError(data.status.msg || `ACRCloud fout (code ${data.status.code}).`);
  }

  const match = data.metadata?.music?.[0];
  if (!match) {
    throw new NoMatchError();
  }

  const result = normalize(match);

  if (!result.coverUrl) {
    result.coverUrl = await fetchCoverArtFallback(result.artist, result.title);
  }

  return result;
}
