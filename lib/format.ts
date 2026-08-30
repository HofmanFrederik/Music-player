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

/** "48 min" / "1u 12m" — total length, coarser than the m:ss transport labels */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}u` : `${hours}u ${minutes}m`;
}

/** "net nu" / "5m geleden" / "3u geleden" / "2d geleden" */
export function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "net nu";
  if (minutes < 60) return `${minutes}m geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}
