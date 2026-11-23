"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

/* Light first. The toggle stores the visitor's choice. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    try {
      if (next) {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("sikio-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("sikio-theme", "light");
      }
    } catch {
      // storage blocked: the theme still switches for this visit
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="brut-sm press !rounded-full w-11 h-11 inline-flex items-center justify-center bg-[var(--paper)] text-[var(--ink)] cursor-pointer shrink-0 overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={{ y: 14, opacity: 0, rotate: -40 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 40 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="inline-flex"
        >
          {dark ? <Sun className="w-[18px] h-[18px]" strokeWidth={2.2} /> : <Moon className="w-[18px] h-[18px]" strokeWidth={2.2} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
