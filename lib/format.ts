function toMinutesSeconds(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "3:33" */
export function formatElapsed(positionMs: number): string {
  return toMinutesSeconds(positionMs);
}

/** "-12:22" */
export function formatRemaining(positionMs: number, durationMs: number): string {
  return `-${toMinutesSeconds(durationMs - positionMs)}`;
}
