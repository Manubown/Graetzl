/**
 * PigeonMark — placeholder Grätzl mascot.
 *
 * A stylised Viennese pigeon silhouette. Intentionally simple; the final
 * mascot will be a designed character (see implementation plan §7).
 * Uses currentColor so it inherits the parent's text color.
 */
export function PigeonMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Grätzl pigeon"
      className={className}
    >
      {/* Body */}
      <path
        d="M14 38 C14 28 22 22 32 22 C42 22 50 28 50 36 C50 44 44 50 36 50 L22 50 C17 50 14 46 14 42 Z"
        fill="currentColor"
      />
      {/* Head */}
      <circle cx="44" cy="20" r="7" fill="currentColor" />
      {/* Beak */}
      <path d="M50 19 L57 20 L50 23 Z" fill="currentColor" />
      {/* Eye */}
      <circle cx="45.5" cy="19" r="1.2" fill="var(--background)" />
      {/* Foot */}
      <path
        d="M28 50 L26 56 M32 50 L32 56 M36 50 L38 56"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
