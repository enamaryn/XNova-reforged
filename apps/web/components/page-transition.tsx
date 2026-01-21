'use client';

import { AnimatePresence, motion, useReducedMotion, type MotionProps } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  const motionProps: MotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.2 },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div key={pathname} {...motionProps}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
