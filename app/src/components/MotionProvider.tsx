"use client";

import React from "react";
import { MotionConfig } from "motion/react";

/*
  One place for motion defaults. `reducedMotion="user"` makes every `motion`
  animation respect the OS "reduce motion" setting automatically.
*/
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.9 }}
    >
      {children}
    </MotionConfig>
  );
}
