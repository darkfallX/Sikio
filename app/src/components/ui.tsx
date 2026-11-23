import React from "react";
import Link from "next/link";
import { ReviewTask } from "@/lib/types";

/*
  Shared primitives for the Lifecycle board design.
  Keep every control at least 44px tall on phones, 40px on desktop.
*/

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "pay";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-[var(--ink)] text-[var(--paper)] hover:opacity-90",
  secondary:
    "hairline bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--hover)]",
  ghost: "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]",
  danger:
    "hairline bg-[var(--paper)] text-[var(--red)] hover:bg-[var(--red-bg)]",
  pay: "bg-[var(--green)] text-white hover:opacity-90",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: "sm" | "md" = "md",
  extra = ""
): string {
  const sizing =
    size === "sm"
      ? "min-h-[44px] sm:min-h-[36px] px-3 text-[13px]"
      : "min-h-[44px] sm:min-h-[40px] px-4 text-sm";
  return `${sizing} inline-flex items-center justify-center gap-1.5 rounded-[var(--r-sm)] font-semibold whitespace-nowrap transition-[opacity,background-color,color] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      {...props}
      className={buttonClass(variant, size, className)}
    />
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Panel({
  className = "",
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "aside";
}) {
  return (
    <Tag
      className={`rounded-[var(--r)] hairline bg-[var(--paper)] ${className}`}
    >
      {children}
    </Tag>
  );
}

/* Lifecycle states in plain words. Colour always matches the board column. */
export const TASK_STATE: Record<
  ReviewTask["status"],
  { label: string; fg: string; bg: string }
> = {
  offered: {
    label: "Needs an ear",
    fg: "text-[var(--signal-ink)]",
    bg: "bg-[var(--signal-bg)]",
  },
  submitted: {
    label: "Heard",
    fg: "text-[var(--heard-ink)]",
    bg: "bg-[var(--heard-bg)]",
  },
  accepted: {
    label: "Paid once",
    fg: "text-[var(--green-ink)]",
    bg: "bg-[var(--green-bg)]",
  },
  rejected: {
    label: "Returned",
    fg: "text-[var(--mute)]",
    bg: "bg-[var(--panel)]",
  },
  expired: {
    label: "Expired",
    fg: "text-[var(--mute)]",
    bg: "bg-[var(--panel)]",
  },
};

export function StatusPill({
  status,
  children,
}: {
  status: ReviewTask["status"];
  children?: React.ReactNode;
}) {
  const s = TASK_STATE[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${s.fg} ${s.bg}`}
    >
      {children ?? s.label}
    </span>
  );
}

/* Small "sandbox" or "live" tag for money references. Never link sandbox hashes. */
export function ModeTag({ live }: { live: boolean }) {
  return (
    <span
      className={`font-mono text-[11px] ${
        live ? "text-[var(--green-ink)]" : "text-[var(--mute)]"
      }`}
    >
      {live ? "live 44005" : "sandbox"}
    </span>
  );
}
