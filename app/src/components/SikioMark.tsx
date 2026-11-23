import React from "react";

interface SikioMarkProps {
  className?: string;
}

/**
 * Candy outline brand mark: a pink disc with an ink outline and an ear-shaped
 * sound arc. Works on light and dusk backgrounds because the disc carries its
 * own outline.
 */
export function SikioMark({ className = "w-7 h-7" }: SikioMarkProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="14" fill="#ffc8ea" stroke="#111" strokeWidth="2.5" />
      <path
        d="M12 22c0-8 3-12 7-12 3 0 5 2 5 5 0 4-4 4.5-4 8"
        fill="none"
        stroke="#111"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="20" cy="24.5" r="1.7" fill="#111" />
    </svg>
  );
}
