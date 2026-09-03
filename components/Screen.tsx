"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

// Shared crossfade used everywhere the app switches between full screens
// (idle/result/error, loading/track, info/lyrics) so nothing just snaps.
export function Screen({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
