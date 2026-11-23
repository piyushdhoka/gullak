// The part of a web page still visible above the on-screen keyboard. Pure (no React Native), so it can be tested.

/** Smaller differences between the page and the visible area are browser chrome, not a keyboard. */
const MIN_KEYBOARD_PX = 80;

/** The visible area while a keyboard covers part of the page, or null when it doesn't. Pure, for tests. */
export function visibleArea(
  layoutHeight: number,
  vv: { height: number; pageTop: number } | null | undefined,
): { height: number; top: number } | null {
  if (!vv || !(vv.height > 0)) return null;
  if (layoutHeight - vv.height <= MIN_KEYBOARD_PX) return null;
  return { height: Math.round(vv.height), top: Math.max(0, Math.round(vv.pageTop)) };
}
