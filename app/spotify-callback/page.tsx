"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { handleCallback } from "@/lib/spotify-auth";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Where Spotify redirects back to after the user grants (or denies) access
 * — registered as the app's redirect URI in the Spotify dashboard. Not a
 * screen anyone navigates to directly, just a brief hop: exchange the code
 * for tokens, then bounce straight back to the app.
 */
function SpotifyCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exchangeFailed, setExchangeFailed] = useState(false);

  const code = searchParams.get("code");
  const denied = searchParams.get("error") !== null;

  useEffect(() => {
    if (denied || !code) return;
    let cancelled = false;

    handleCallback(code)
      .then(() => {
        if (!cancelled) router.replace("/");
      })
      .catch(() => {
        if (!cancelled) setExchangeFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [code, denied, router]);

  const error = denied
    ? "Spotify-koppeling geweigerd."
    : !code
      ? "Geen code ontvangen van Spotify."
      : exchangeFailed
        ? "Kon niet koppelen met Spotify."
        : null;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-black px-6 text-center text-white">
      {error ? (
        <>
          <p className="text-sm text-red-300">{error}</p>
          <a href={BASE_PATH} className="text-sm text-white/70 underline">
            Terug naar de app
          </a>
        </>
      ) : (
        <p className="text-sm text-white/70">Koppelen met Spotify&hellip;</p>
      )}
    </div>
  );
}

export default function SpotifyCallbackPage() {
  return (
    <Suspense>
      <SpotifyCallback />
    </Suspense>
  );
}
