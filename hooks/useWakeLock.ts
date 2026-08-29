"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the screen awake for as long as the app is open — without it, the
 * device's normal auto-lock defeats the "always listening" flow the moment
 * it kicks in (e.g. phone left on a table). The browser releases the lock
 * automatically whenever the tab/screen is hidden, so it has to be
 * re-acquired on visibilitychange. Silently does nothing on browsers that
 * don't support the API (e.g. iOS Safari < 16.4) — falls back to normal
 * auto-lock behavior rather than erroring.
 */
export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release();
          return;
        }
        lockRef.current = lock;
        lock.addEventListener("release", () => {
          lockRef.current = null;
        });
      } catch {
        // Rejected (low battery, permissions, ...) — just no wake lock.
      }
    };

    acquire();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !lockRef.current) {
        acquire();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      lockRef.current?.release();
      lockRef.current = null;
    };
  }, []);
}
