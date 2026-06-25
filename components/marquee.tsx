// Marquee design kit — shared className recipes + inline SVG icons (paths lifted
// from docs/design/marquee-reference.html). Presentation only; no game logic.
// Colors come from the parent's text color via `currentColor`, so e.g.
// <Check className="text-ink" /> draws an ink check on a gold button.

type IconProps = { size?: number; className?: string };

const svg = (size: number, className: string | undefined, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden
    className={className}
  >
    {children}
  </svg>
);

export const Clapperboard = ({ size = 16, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth={2} />
      <path
        d="M8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4"
        stroke="currentColor"
        strokeWidth={1.6}
      />
    </>
  );

export const Check = ({ size = 15, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M5 13l4 4L19 7"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

export const Heart = ({ size = 14, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3.2 1.2 4 2.5.8-1.3 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 16.5 12 21 12 21z"
      fill="currentColor"
    />
  );

export const XMark = ({ size = 16, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M6 6l12 12M18 6L6 18"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  );

export const Question = ({ size = 16, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <path
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </>
  );

export const Chevron = ({ size = 14, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

export const ExternalArrow = ({ size = 14, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M7 17L17 7M9 7h8v8"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );

export const Sparkle = ({ size = 30, className }: IconProps) =>
  svg(
    size,
    className,
    <path
      d="M12 3l2.2 5.6L20 9.8l-4.4 3.6L17 19l-5-3-5 3 1.4-5.6L4 9.8l5.8-1.2L12 3z"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );

export const Phone = ({ size = 34, className }: IconProps) =>
  svg(
    size,
    className,
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" stroke="currentColor" strokeWidth={1.7} />
      <path d="M10 18.5h4" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
    </>
  );

// ── className recipes ────────────────────────────────────────────────────────
// Warm off-white surfaces/borders are expressed as `*-text/<alpha>` since
// --color-text is #F5F1E8 (so bg-text/[0.03] === the --surface token, exactly).

/** Gold gradient surface fragment (compose with sizing). */
export const GOLD_SURFACE =
  "bg-[linear-gradient(150deg,#E8C07D,#C99B53)] text-ink shadow-[0_14px_34px_-12px_rgba(232,192,125,0.6)]";

/** Full-width pinned CTA. Disabled → faint flat fill. */
export const goldCta =
  `w-full rounded-2xl px-6 py-4 text-[15px] font-bold ${GOLD_SURFACE} transition active:scale-[0.98] ` +
  "disabled:bg-none disabled:bg-text/[0.08] disabled:text-text/30 disabled:shadow-none disabled:active:scale-100";

/** Outline / ghost button (e.g. Play again). */
export const ghostBtn =
  "w-full rounded-2xl border border-text/15 px-6 py-3.5 text-sm font-semibold text-text transition active:scale-[0.98]";

export const eyebrow = "text-[11px] uppercase tracking-[1.5px] text-gold";
export const eyebrowNeutral = "text-[11px] uppercase tracking-[1.5px] text-text/45";

/** Round-header pill badge (gold). */
export const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-gold/35 px-3 py-[5px] text-[11px] uppercase tracking-[1.5px] text-gold";

export const tag =
  "rounded-full bg-text/[0.07] px-2.5 py-1 text-[11px] text-text/60";

/** Selectable chip (Round 1). */
export const chipBase =
  "rounded-full border px-[15px] py-2.5 text-[13.5px] font-medium transition";
export const chipOn = "border-gold/75 bg-gold/[0.14] text-gold";
export const chipOff = "border-text/12 bg-text/[0.03] text-text";

/** Soft surface card. */
export const surfaceCard = "rounded-2xl border border-text/10 bg-text/[0.03]";

/** Vertical screen frame: fills the column, CTA pins at the bottom. */
export const screenCol = "flex min-h-full flex-1 flex-col";

/** 96px ring spinner — static faint ring under a spinning two-tone arc, with a
 * centered icon. `accent` is a text-color class (text-gold / text-rose) driving
 * both the spinning arc (via currentColor) and the icon. */
export function Spinner({ accent = "text-gold", children }: { accent?: string; children: React.ReactNode }) {
  return (
    <div className={`relative mb-8 h-24 w-24 ${accent}`}>
      <span className="absolute inset-0 rounded-full border-2 border-text/[0.08]" />
      <span
        className="absolute inset-0 rounded-full border-2 border-transparent motion-safe:animate-[mmSpin_1.1s_linear_infinite]"
        style={{ borderTopColor: "currentColor", borderRightColor: "currentColor" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Centered loader column (spinner + serif title + copy + optional extra). */
export const loaderCol = "flex min-h-full flex-1 flex-col items-center justify-center text-center";

/** A 3-segment round-progress indicator; `done` segments are gold. */
export function Progress({ done }: { done: number }) {
  return (
    <div className="flex gap-[5px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-[3px] w-[22px] rounded-sm ${i < done ? "bg-gold" : "bg-text/16"}`}
        />
      ))}
    </div>
  );
}
