/**
 * Parallel route default for the @modal slot.
 * Returns null so the slot collapses when no intercept matches —
 * e.g. on / or any other page where we don't want a modal open.
 */
export default function ModalDefault() {
  return null;
}
