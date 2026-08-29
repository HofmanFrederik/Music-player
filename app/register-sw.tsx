"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // Never register in dev: Turbopack's dev chunk/CSS URLs aren't
    // content-hashed, so a cache-first SW would keep serving stale styles
    // across reloads instead of picking up new code.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registratie mislukt", error);
    });
  }, []);

  return null;
}
