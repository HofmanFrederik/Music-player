"use client";

import { AnimatePresence, motion } from "framer-motion";

interface BlurredBackgroundProps {
  src?: string;
  blurPx?: number;
  overlayOpacity?: number;
}

/**
 * Full-bleed blurred background. Renders the Figma idle gradient
 * (node 2:154, 155.56deg #121212 -> #001BA2) whenever `src` is absent,
 * so it doubles as the offline fallback for the idle art cycle and as the
 * base layer while a cover image loads or fails post-match. The 0.25 dark
 * overlay matches the "Background blur" layer measured identically on both
 * the idle (2:154) and info (1:96) Figma nodes.
 */
export function BlurredBackground({
  src,
  blurPx = 72,
  overlayOpacity = 0.25,
}: BlurredBackgroundProps) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(155.56deg, #121212 0.14%, #001BA2 99.86%)",
      }}
    >
      <AnimatePresence>
        {src && (
          <motion.div
            key={src}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external hosts (iTunes/Deezer), can't be enumerated in next.config */}
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover"
              style={{ filter: `blur(${blurPx}px)`, transform: "scale(1.15)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
    </div>
  );
}
