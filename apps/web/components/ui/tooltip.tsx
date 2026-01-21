'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type MotionProps } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const motionProps: MotionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 },
        transition: { duration: 0.16 },
      };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <span className="inline-flex">{children}</span>
      <AnimatePresence>
        {isVisible ? (
          <motion.span
            {...motionProps}
            role="tooltip"
            className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 shadow-lg"
          >
            {content}
            <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
