import { motion } from "motion/react";

/**
 * Photo frame: fixed aspect ratio, rounded corners, zooms slightly on hover.
 * overlay: "none" | "bottom" (text-over-photo gradient) | "dark" (heavy tint for backgrounds)
 */
export default function Photo({ photo, ratio = "4 / 3", overlay = "none", className = "", children }) {
  return (
    <motion.figure className={`lp-photo ${className}`} style={{ aspectRatio: ratio }}
      initial="rest" whileHover="hover">
      <motion.img src={photo.src} alt={photo.alt} loading="lazy" decoding="async"
        style={{ objectPosition: photo.pos }}
        variants={{ rest: { scale: 1 }, hover: { scale: 1.06 } }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      {overlay !== "none" && <span className={`lp-overlay lp-overlay-${overlay}`} aria-hidden="true" />}
      {children}
    </motion.figure>
  );
}
