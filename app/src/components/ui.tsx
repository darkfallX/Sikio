import React from "react";
import Link from "next/link";
import { ReviewTask } from "@/lib/types";

/*
  Candy outline primitives. Every page builds from these so the look stays
  consistent: thick ink outline, hard offset shadow, pastel fills, pill buttons
  that sink into their shadow when pressed. Controls are >= 44px on phones.
*/

export type Tone = "pink" | "yellow" | "sky" | "mint" | "lilac" | "peach" | "paper" | "ink";

export const TONE_BG: Record<Tone, string> = {
  pink: "bg-[var(--pink)] text-[var(--on-pastel)]",
  yellow: "bg-[var(--yellow)] text-[var(--on-pastel)]",
  sky: "bg-[var(--sky)] text-[var(--on-pastel)]",
  mint: "bg-[var(--mint)] text-[var(--on-pastel)]",
  lilac: "bg-[var(--lilac)] text-[var(--on-pastel)]",
  peach: "bg-[var(--peach)] text-[var(--on-pastel)]",
  paper: "bg-[var(--paper)] text-[var(--ink)]",
  ink: "bg-[var(--ink)] text-[var(--bg)]",
};

/* ---------------- Buttons ---------------- */

type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "pay" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "brut-sm press bg-[var(--cta-bg)] text-[var(--cta-ink)]",
  dark: "brut-sm press bg-[#111] text-white",
  secondary: "brut-sm press bg-[var(--paper)] text-[var(--ink)]",
  ghost:
    "border-2 border-transparent text-[var(--ink)] hover:border-[var(--outline)] hover:bg-[var(--paper)]",
  pay: "brut-sm press bg-[var(--mint)] text-[var(--on-pastel)]",
  danger: "brut-sm press bg-[var(--paper)] text-[var(--error)]",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: "sm" | "md" | "lg" = "md",
  extra = ""
): string {
  const sizing =
    size === "sm"
      ? "min-h-[44px] sm:min-h-[38px] px-3.5 text-[13px]"
      : size === "lg"
      ? "min-h-[52px] px-6 text-[16px]"
      : "min-h-[44px] px-5 text-[14px]";
  return `${sizing} !rounded-full inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button type="button" {...props} className={buttonClass(variant, size, className)} />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({
  tone = "paper",
  shadow = "md",
  className = "",
  children,
  as: Tag = "div",
  ...rest
}: {
  tone?: Tone;
  shadow?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "aside" | "article" | "li";
} & React.HTMLAttributes<HTMLElement>) {
  const sh =
    shadow === "none" ? "brut-flat" : shadow === "sm" ? "brut-sm" : shadow === "lg" ? "brut-lg" : "brut";
  return (
    <Tag className={`${sh} ${TONE_BG[tone]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* Small outlined pill label */
export function Tag({
  tone = "paper",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border-2 border-[var(--outline)] text-[12px] font-bold whitespace-nowrap ${TONE_BG[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------------- Lifecycle state ---------------- */

export const TASK_STATE: Record<ReviewTask["status"], { label: string; tone: Tone }> = {
  offered: { label: "Needs an ear", tone: "yellow" },
  submitted: { label: "Heard", tone: "sky" },
  accepted: { label: "Paid once", tone: "mint" },
  rejected: { label: "Returned", tone: "paper" },
  expired: { label: "Expired", tone: "paper" },
};

export function StatusPill({
  status,
  children,
}: {
  status: ReviewTask["status"];
  children?: React.ReactNode;
}) {
  const s = TASK_STATE[status];
  return <Tag tone={s.tone}>{children ?? s.label}</Tag>;
}

/* "sandbox" or "live 44005". Never link sandbox hashes to the explorer. */
export function ModeTag({ live }: { live: boolean }) {
  return (
    <span
      className={`font-mono text-[11px] font-bold ${
        live ? "text-[var(--paid-ink)]" : "text-[var(--mute)]"
      }`}
    >
      {live ? "live 44005" : "sandbox"}
    </span>
  );
}

/* Motion helpers live in a client module; re-exported here so pages import one place. */
export { Reveal, CountUp, SPRING } from "./motion-kit";
