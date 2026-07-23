"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface VirtualCursorProps {
  cursorCoords: { x: number; y: number } | null;
  initialCoords: { x: number; y: number };
  cursorClicking: boolean;
  cursorRipple: boolean;
  phase?: string;
  duration?: number;
}

export function VirtualCursor({
  cursorCoords,
  initialCoords,
  cursorClicking,
  cursorRipple,
  phase,
  duration,
}: VirtualCursorProps) {
  // Determine movement duration dynamically
  const isFastPhase = 
    phase === "readyToApply" || 
    phase === "submitting" || 
    phase === "transitioning" || 
    phase === "decision" || 
    phase === "approved" || 
    phase === "hiringModal";

  const animDuration = duration !== undefined ? duration : (isFastPhase ? 0.08 : 0.8);

  return (
    <AnimatePresence>
      {cursorCoords && (
        <motion.div
          initial={{
            x: initialCoords.x,
            y: initialCoords.y,
            opacity: 0,
          }}
          animate={{
            x: cursorCoords.x,
            y: cursorCoords.y,
            opacity: 1,
          }}
          transition={{
            x: {
              duration: animDuration,
              ease: EASE_EXPO,
            },
            y: {
              duration: animDuration,
              ease: EASE_EXPO,
            },
            opacity: { duration: 0.3, ease: "easeOut" },
          }}
          className="absolute pointer-events-none z-100 flex items-center justify-center"
          style={{
            top: 0,
            left: 0,
          }}
        >
          {/* Pulsing Ripple ring */}
          <AnimatePresence>
            {cursorRipple && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{
                  scale: [1, 2.2, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                className="absolute w-8 h-8 rounded-full border-2 border-accent bg-accent/10 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Cursor Arrow SVG */}
          <motion.svg
            className="h-5 w-5 text-foreground fill-current drop-shadow-md select-none pointer-events-none"
            style={{ transform: "translate(6px, 7px)" }}
            viewBox="0 0 24 24"
            animate={cursorClicking ? { scale: [1, 0.82, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <path d="M4.5 3v15.2l3.9-3.9 3.2 7.7 2.6-1.1-3.2-7.7 5.6-.1z" />
          </motion.svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default VirtualCursor;
