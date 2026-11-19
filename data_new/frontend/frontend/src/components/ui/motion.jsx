import { motion } from "motion/react";
import { EASE } from "./easing";

/** Fade + rise when scrolled into view (plays once). */
export function Reveal({ children, delay = 0, y = 24, className = "", ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };

/** Wrap a group; each <StaggerItem> inside animates in sequence. */
export function Stagger({ children, className = "", ...rest }) {
  return (
    <motion.div className={className} variants={container} initial="hidden"
      whileInView="show" viewport={{ once: true, margin: "-80px" }} {...rest}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "", ...rest }) {
  return <motion.div className={className} variants={item} {...rest}>{children}</motion.div>;
}

/** Slowly bobbing card (used for floating info cards). */
export function Float({ children, className = "", delay = 0, ...rest }) {
  return (
    <motion.div className={className}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay }} {...rest}>
      {children}
    </motion.div>
  );
}
