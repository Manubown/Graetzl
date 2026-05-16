export type GlassSurface = "floating" | "elevated" | "solid";
export type GlassOptions = { border?: boolean; shadow?: "sm" | "md" | "lg" };

/**
 * Returns a className string composing surface background + blur +
 * optional border/shadow. Pair with the global CSS fallbacks in
 * globals.css — no JS branching for prefers-reduced-transparency
 * because the CSS layer handles it.
 *
 * Blur radius is fixed per surface (floating/elevated use --blur-md,
 * solid uses --blur-sm) so consumers don't pick. Override via Tailwind
 * `backdrop-blur-[...]` after the helper if you really need to.
 */
export function glass(
  surface: GlassSurface,
  opts: GlassOptions = {},
): string {
  const surfaceClass =
    surface === "floating"
      ? "bg-surface-floating backdrop-blur-[var(--blur-md)]"
      : surface === "elevated"
        ? "bg-surface-elevated backdrop-blur-[var(--blur-md)]"
        : "bg-surface-solid backdrop-blur-[var(--blur-sm)]";

  const parts = [surfaceClass];
  if (opts.border) parts.push("border border-border");
  if (opts.shadow) parts.push(`shadow-${opts.shadow}`);
  return parts.join(" ");
}
