"use client";

import { motion } from "framer-motion";

/** Page transition — re-mounts on every navigation. Opacity only: a transform here would break GSAP pinning. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
