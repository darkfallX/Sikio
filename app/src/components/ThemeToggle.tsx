"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = document.documentElement.getAttribute("data-theme") === "dark";
    setDark(current);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("sikio-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("sikio-theme", "light");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-[8px] hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)] transition-colors cursor-pointer shrink-0"
    >
      {mounted && dark ? (
        <Sun className="w-4 h-4" strokeWidth={1.8} />
      ) : (
        <Moon className="w-4 h-4" strokeWidth={1.8} />
      )}
    </button>
  );
}
