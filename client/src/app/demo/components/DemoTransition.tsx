"use client";

import React, { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useDemoStore } from "../stores/use-demo-store";
import { type DemoTransitionType } from "../config";

interface DemoTransitionProps {
  children: ReactNode;
  transitionType: DemoTransitionType;
}

export function DemoTransition({ children, transitionType }: DemoTransitionProps) {
  const direction = useDemoStore((state) => state.navigationDirection);
  const setTransitionState = useDemoStore((state) => state.setTransitionState);
  const prefersReducedMotion = useReducedMotion();

  // If user requests reduced motion, fall back to simple opacity fade
  const activeTransition = prefersReducedMotion ? "fade" : transitionType;

  const getVariants = (): Variants => {
    switch (activeTransition) {
      case "fade":
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        };
      case "slide-x":
        return {
          initial: { opacity: 0, x: direction === "next" ? 300 : -300 },
          animate: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: direction === "next" ? -300 : 300 },
        };
      case "slide-y":
        return {
          initial: { opacity: 0, y: direction === "next" ? 300 : -300 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: direction === "next" ? -300 : 300 },
        };
      case "scale":
        return {
          initial: { opacity: 0, scale: 0.92 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.08 },
        };
      case "blur":
        return {
          initial: { opacity: 0, filter: "blur(16px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          exit: { opacity: 0, filter: "blur(16px)" },
        };
      case "none":
      default:
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 1 },
        };
    }
  };

  return (
    <motion.div
      variants={getVariants()}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: activeTransition === "none" ? 0 : 0.6,
        ease: [0.16, 1, 0.3, 1] as const, // easeOutExpo
      }}
      onAnimationStart={() => {
        setTransitionState("entering");
      }}
      onAnimationComplete={() => {
        setTransitionState("active");
      }}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
    >
      {children}
    </motion.div>
  );
}

export default DemoTransition;
