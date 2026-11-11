"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Props = HTMLMotionProps<"div"> & { delay?: number; y?: number; as?: "div" | "li" };

/** Fades and lifts content in once it scrolls into view. Use as="li" inside lists. */
export function Reveal({ delay = 0, y = 24, as = "div", children, ...rest }: Props) {
  const Comp = (as === "li" ? motion.li : motion.div) as typeof motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
