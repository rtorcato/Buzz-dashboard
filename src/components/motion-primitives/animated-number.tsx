"use client";

import {
  motion,
  type SpringOptions,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";

// motion-primitives AnimatedNumber (https://motion-primitives.com), trimmed to
// a span. DESIGN.md → Motion: no bounce, so a % never wobbles across a
// threshold. It starts at `value`, so a first render or an unchanged refresh
// doesn't animate, and it jumps straight to new values under reduced motion.
const SPRING: SpringOptions = { bounce: 0, duration: 600 };

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const spring = useSpring(value, SPRING);
  const display = useTransform(spring, (n) => Math.round(n).toLocaleString());

  useEffect(() => {
    if (reduced) spring.jump(value);
    else spring.set(value);
  }, [spring, value, reduced]);

  return (
    <motion.span className={`tabular-nums ${className ?? ""}`}>
      {display}
    </motion.span>
  );
}
