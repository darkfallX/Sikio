import React from "react";

interface SikioMarkProps {
  className?: string;
}

/**
 * Minimal brand mark: ink acoustic arc paired with one signal orange dot.
 */
export function SikioMark({ className = "w-6 h-6" }: SikioMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M12.5 3.5C7.8 3.5 4 7.3 4 12C4 16.7 7.8 20.5 12.5 20.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12.5 7.5C10 7.5 8 9.5 8 12C8 14.5 10 16.5 12.5 16.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="16.5" cy="12" r="2.75" fill="var(--signal)" />
    </svg>
  );
}
