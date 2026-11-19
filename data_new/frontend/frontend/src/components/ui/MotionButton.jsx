import { Link } from "react-router-dom";
import { motion } from "motion/react";

const MotionLink = motion.create(Link);
const press = { whileHover: { y: -2 }, whileTap: { scale: 0.97 }, transition: { type: "spring", stiffness: 400, damping: 26 } };

/** variant: "solid" | "outline" | "light" | "ghost".  Use `to` for routes, `href` for #anchors. */
export default function MotionButton({ to, href, variant = "solid", large = false, className = "", children, ...rest }) {
  const cls = `lp-btn lp-btn-${variant} ${large ? "lp-btn-lg" : ""} ${className}`;
  if (to) return <MotionLink to={to} className={cls} {...press} {...rest}>{children}</MotionLink>;
  return <motion.a href={href} className={cls} {...press} {...rest}>{children}</motion.a>;
}
