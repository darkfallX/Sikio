import React from "react";

interface SikioMarkProps {
  className?: string;
}

/**
 * Custom geometric acoustic-ear brand mark for Sikio (Swahili: "ear").
 * Outer listening arc + inner focal pin + live terracotta signal bar.
 */
export function SikioMark({ className = "w-7 h-7" }: SikioMarkProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="28" height="28" rx="6" fill="#141311" />
      <path
        d="M14 6.25C9.72 6.25 6.25 9.72 6.25 14C6.25 18.28 9.72 21.75 14 21.75"
        stroke="#FBF9F4"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M14 9.75C11.65 9.75 9.75 11.65 9.75 14C9.75 16.35 11.65 18.25 14 18.25"
        stroke="#A69F93"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <rect x="15.2" y="10.2" width="2.4" height="7.6" rx="1.2" fill="#C94A22" />
      <rect x="19.3" y="12.2" width="2.2" height="3.6" rx="1.1" fill="#FBF9F4" />
    </svg>
  );
}
