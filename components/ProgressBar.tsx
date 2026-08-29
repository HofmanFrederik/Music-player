interface ProgressBarProps {
  /** 0-1 */
  progress: number;
  className?: string;
}

export function ProgressBar({ progress, className = "" }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className={`h-[7px] rounded-full bg-white/25 ${className}`}>
      <div
        className="h-full rounded-full bg-white"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
