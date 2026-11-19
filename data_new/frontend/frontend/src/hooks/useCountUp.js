import { useEffect, useRef, useState } from "react";

/** Animates 0 -> target once the element scrolls into view. Honors reduced-motion. */
export default function useCountUp(target, duration = 1100) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (target == null || !ref.current || reduced) return;
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / duration, 1);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target, duration, reduced]);

  return [ref, reduced ? target : value];
}
