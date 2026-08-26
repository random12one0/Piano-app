/**
 * Shared class strings for the recurring roles in the interface.
 *
 * `font-mono text-xs uppercase tracking-wider` had grown to 28 uses covering
 * more than twenty different jobs — including two byte-identical strings on
 * the song page where one was a link and one was inert text, told apart only
 * by a hover state that doesn't exist on a touchscreen. One treatment per
 * role, defined once, so a label reads as a label and a link reads as a link.
 */

/** Section eyebrow: "Notes", "Segments", "Status". Never interactive. */
export const LABEL =
  "font-mono text-[11px] font-medium uppercase tracking-wider text-foreground-dim";

/** The page's own kicker, above a display heading. */
export const EYEBROW =
  "font-mono text-[11px] font-medium uppercase tracking-[0.2em]";

/** Inline navigation — reads as a link, and stays legible without hover. */
export const LINK =
  "font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim underline decoration-rule decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent";

/** Secondary button: bordered, 44px tall. */
export const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center border border-rule px-4 font-mono text-xs font-medium uppercase tracking-wider text-foreground-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

/** Primary button: filled with the accent. */
export const BUTTON_ACCENT =
  "inline-flex min-h-11 cursor-pointer items-center border border-accent bg-accent px-4 font-mono text-xs font-medium uppercase tracking-wider text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50";

/** Text field, at the 16px iOS needs to leave the viewport alone. */
export const INPUT =
  "min-h-11 w-full border border-rule bg-surface px-3 py-2 font-sans text-base text-foreground placeholder:text-foreground-dim/60 focus:border-accent focus:outline-none";
