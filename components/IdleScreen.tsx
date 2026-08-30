"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import { BlurredBackground } from "./BlurredBackground";
import { useIdleArtwork } from "@/hooks/useIdleArtwork";

interface IdleScreenProps {
  onTap: () => void;
  recording: boolean;
  disabled?: boolean;
  onShowHistory: () => void;
}

/**
 * Figma node 2:154 ("Show music video" / idle state, landscape only). The
 * design has only the gradient + pulsing "Listening to the music..." text
 * — no button, no other chrome. Text sits at left 74px / vertical-center
 * of the 844x390 frame (measured from the rendered screenshot, ~8.8% from
 * the left edge). The flat gradient is swapped for cycling, heavily
 * blurred album covers per product direction; the exact Figma gradient
 * remains the fallback.
 *
 * Portrait has no Figma reference — text centers instead of hugging the
 * left edge (a left-anchored heading wastes most of a narrow, tall
 * screen) and drops a size, via the `portrait:`/`landscape:` variants.
 * Font size is also fluid (`clamp(min, Nvmin, max)`) rather than a fixed
 * px value, so it scales with the actual screen instead of only looking
 * right at the two reference sizes (844x390 / 390x844) — vmin ties it to
 * whichever of width/height is smaller, which is the dimension that
 * actually constrains a landscape-locked layout in either orientation.
 *
 * The history button (top-left, not in Figma) is a real nested <button>,
 * so the root can't be a <button> itself (invalid HTML) — it's a
 * role="button" div instead, with the same click/keyboard behavior.
 */
export function IdleScreen({ onTap, recording, disabled, onShowHistory }: IdleScreenProps) {
  const { url } = useIdleArtwork();

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onTap}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTap();
        }
      }}
      className="relative flex-1 w-full overflow-hidden text-left disabled:cursor-not-allowed"
      aria-label="Tik om te herkennen welke muziek er speelt"
    >
      <BlurredBackground src={url} blurPx={72} />

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onShowHistory();
        }}
        aria-label="Geschiedenis"
        className="absolute left-[8.8%] top-[calc(clamp(22px,7.95vmin,42px)_+_env(safe-area-inset-top))] z-20 flex items-center justify-center text-white opacity-70 transition-opacity hover:opacity-100 portrait:left-[calc(clamp(22px,7.95vmin,42px)_+_env(safe-area-inset-left))]"
      >
        <History className="h-[clamp(19px,6.67vmin,35px)] w-[clamp(19px,6.67vmin,35px)]" strokeWidth={1.75} />
      </button>

      <div className="relative z-10 flex h-full w-full items-center landscape:pl-[8.8%] landscape:pr-6 portrait:justify-center portrait:px-8">
        <motion.p
          className="font-sans font-bold leading-none text-white landscape:text-left landscape:text-[clamp(28px,10vmin,53px)] portrait:text-center portrait:leading-tight portrait:text-[clamp(22px,7.69vmin,40px)]"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{
            duration: recording ? 1.1 : 2.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          Listening to the music...
        </motion.p>
      </div>
    </div>
  );
}
