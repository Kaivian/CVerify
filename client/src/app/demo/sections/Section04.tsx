"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Sparkles, Trophy } from "lucide-react";
import { Card } from "@heroui/react";
import { type SceneLifecycleState } from "../stores/use-demo-store";

interface Section04Props {
  lifecycleState: SceneLifecycleState;
  onStateComplete: (state: SceneLifecycleState) => void;
}

export function Section04({ lifecycleState, onStateComplete }: Section04Props) {
  useEffect(() => {
    if (lifecycleState === "active") {
      onStateComplete("active");
    }
  }, [lifecycleState, onStateComplete]);

  return (
    <div className="w-full max-w-2xl text-center select-none font-sans space-y-6">
      <Card className="p-8 border border-border bg-background shadow-2xl flex flex-col items-center gap-6">
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center text-success border border-success/30"
        >
          <Trophy size={28} />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-outfit text-foreground flex items-center justify-center gap-2">
            Profile Integration Complete <Sparkles size={18} className="text-accent animate-pulse" />
          </h2>
          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
            Congratulations! Your verified GitHub contributions have been securely indexed. Cryptographic proofs have been successfully linked to your candidate profile.
          </p>
        </div>

        <div className="w-full max-w-xs bg-success/5 border border-success/20 rounded-xl p-4 space-y-2.5 text-left">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            <span className="text-[11px] font-medium text-foreground">Repositories linked: 2</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            <span className="text-[11px] font-medium text-foreground">Trust Score verified: 96%</span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={16} className="text-success shrink-0" />
            <span className="text-[11px] font-medium text-foreground">Experience proofs generated</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Section04;
