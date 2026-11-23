import React from "react";

/*
  Sikio art kit: candy-3D objects and drawn illustrations.
  Everything is ink-outlined with a hard shadow so it sits in the
  Candy outline world. Purely decorative: always aria-hidden.
*/

/* Glossy outlined coin. `label` is drawn on its face. */
export function Coin({
  size = 88,
  label = "$0.10",
  className = "",
  style,
}: {
  size?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center rounded-full border-2 border-[#111] font-mono font-bold text-[#111] select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.19),
        background:
          "radial-gradient(circle at 32% 28%, #ffffff 0 7%, #fffbd1 14%, #fff27a 42%, #f2cf2a 78%, #d9a900 100%)",
        boxShadow: "4px 4px 0 #111, inset -5px -7px 0 rgba(160,110,0,0.25)",
        ...style,
      }}
    >
      <span
        className="grid place-items-center rounded-full border-2 border-dashed border-[#111]/40"
        style={{ width: size * 0.74, height: size * 0.74 }}
      >
        {label}
      </span>
    </div>
  );
}

/* Glossy outlined sphere in a pastel tone */
export function Orb({
  size = 64,
  color = "#b8efff",
  className = "",
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-full border-2 border-[#111] ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 34% 30%, #ffffff 0 9%, ${color} 46%, color-mix(in srgb, ${color} 70%, #000 12%) 100%)`,
        boxShadow: "4px 4px 0 #111",
        ...style,
      }}
    />
  );
}

/* Soft organic backdrop shape */
export function Blob({
  color = "#b8efff",
  className = "",
  style,
}: {
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`border-2 border-[#111] ${className}`}
      style={{
        background: color,
        borderRadius: "38% 62% 56% 44% / 46% 40% 60% 54%",
        ...style,
      }}
    />
  );
}

/* Four-point sparkle */
export function Sparkle({
  size = 28,
  color = "#ffc8ea",
  className = "",
  style,
}: {
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      style={style}
    >
      <path
        d="M16 2 C17.6 11 21 14.4 30 16 C21 17.6 17.6 21 16 30 C14.4 21 11 17.6 2 16 C11 14.4 14.4 11 16 2 Z"
        fill={color}
        stroke="#111"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Step illustrations: AI listens, a native ear fixes, paid once */
export function IllustrationAI({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 96" className={className}>
      <rect x="8" y="22" width="80" height="52" rx="18" fill="#fff" stroke="#111" strokeWidth="3" />
      <path
        d="M20 48h6l5-13 6 26 6-19 5 8h6l5-10 5 10h8"
        fill="none"
        stroke="#111"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="72" cy="22" r="11" fill="#fff27a" stroke="#111" strokeWidth="3" />
      <text x="72" y="27" textAnchor="middle" fontFamily="monospace" fontWeight="700" fontSize="13" fill="#111">?</text>
    </svg>
  );
}

export function IllustrationEar({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 96" className={className}>
      <circle cx="48" cy="48" r="38" fill="#fff" stroke="#111" strokeWidth="3" />
      <path
        d="M36 62c0-22 8-34 19-34 9 0 14 6 14 14 0 11-12 12-12 22 0 5-4 8-8 8"
        fill="none"
        stroke="#111"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path d="M48 52c0-6 2-10 6-10" fill="none" stroke="#111" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M76 30c4 4 6 10 6 18M82 22c6 7 9 16 9 26" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function IllustrationPay({ className = "w-20 h-20" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 96" className={className}>
      <circle cx="48" cy="50" r="36" fill="#fff27a" stroke="#111" strokeWidth="3" />
      <circle cx="48" cy="50" r="26" fill="none" stroke="#111" strokeWidth="2.5" strokeDasharray="4 5" />
      <path d="M36 51l9 9 16-19" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M80 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffc8ea" stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* A deterministic smooth, mirrored speech wave path (for decorative voice notes only).
   Real audio uses OrganicWaveRibbon. */
export function wavePath(seed: number, w: number, h: number, amp = 0.45): string {
  const n = 48;
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const a =
      0.22 +
      0.62 * Math.abs(Math.sin(x * 19 + seed)) * (0.6 + 0.4 * Math.sin(x * 7 + seed * 2));
    const edge = Math.sin(Math.PI * x) * 0.85 + 0.15;
    top.push([x * w, h / 2 - a * edge * h * amp]);
    bot.push([x * w, h / 2 + a * edge * h * amp * 0.9]);
  }
  const smooth = (p: [number, number][]) => {
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let k = 1; k < p.length; k++) {
      const q = p[k - 1];
      const c = p[k];
      d += ` Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${((q[0] + c[0]) / 2).toFixed(1)} ${((q[1] + c[1]) / 2).toFixed(1)}`;
    }
    return d;
  };
  const back = smooth([...bot].reverse()).replace(/^M/, "L");
  return `${smooth(top)} L${w} ${h / 2} ${back} Z`;
}

export function WaveGlyph({
  seed = 1,
  className = "w-full h-6",
  color = "currentColor",
  progress,
}: {
  seed?: number;
  className?: string;
  color?: string;
  /** 0..1, draws the played part solid and the rest faded */
  progress?: number;
}) {
  const d = wavePath(seed, 200, 40);
  const id = `wg-${seed}-${Math.round((progress ?? 1) * 100)}`;
  return (
    <svg aria-hidden="true" viewBox="0 0 200 40" preserveAspectRatio="none" className={className}>
      {typeof progress === "number" && (
        <defs>
          <clipPath id={id}>
            <rect x="0" y="0" width={200 * Math.max(0, Math.min(1, progress))} height="40" />
          </clipPath>
        </defs>
      )}
      <path d={d} fill={color} opacity={typeof progress === "number" ? 0.25 : 0.85} />
      {typeof progress === "number" && <path d={d} fill={color} clipPath={`url(#${id})`} />}
    </svg>
  );
}
