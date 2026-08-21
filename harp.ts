// The strings: how many, tuned to what, and where they sit. Pure and
// DOM-free, in fractions of the frame, so the same numbers describe the harp
// at 1920x1080 and at 390x844 and a test can ask what a drag crossed without
// a browser.

/**
 * A minor pentatonic, two octaves. Five notes with no minor second and no
 * tritone anywhere in the set, so no two strings can clash — which is what
 * makes "there is no way to play it wrong" a property of the tuning rather
 * than a missing fail state. A drag across all of it is a glissando that
 * lands, every time, whoever does the dragging.
 */
const SCALE = [0, 3, 5, 7, 10];
const ROOT_HZ = 220; // A3
export const STRING_COUNT = 11;

export type HarpString = {
  index: number;
  frequency: number;
  /** Across the frame, 0 to 1. */
  x: number;
  /** Key that plucks it. */
  key: string;
};

const KEYS = "asdfghjkl;'";

export const STRINGS: readonly HarpString[] = Array.from({ length: STRING_COUNT }, (_, i) => ({
  index: i,
  frequency: ROOT_HZ * Math.pow(2, (SCALE[i % SCALE.length] + 12 * Math.floor(i / SCALE.length)) / 12),
  // Inset from the frame so the outermost strings are still comfortably
  // reachable rather than pinned against the edge.
  x: 0.08 + (i / (STRING_COUNT - 1)) * 0.84,
  key: KEYS[i] ?? "",
}));

/** Vertical extent of the strings within the frame. */
export const TOP = 0.06;
export const BOTTOM = 0.94;

/** Where along a string a point sits, 0 at the top anchor to 1 at the bottom. */
export function pluckPosition(y: number): number {
  return Math.min(1, Math.max(0, (y - TOP) / (BOTTOM - TOP)));
}

/**
 * Every string a movement crossed, in the order it crossed them. A drag is a
 * glissando, and a glissando is why this instrument works where three drums
 * did not — one gesture becomes eight overlapping notes. Plucking only the
 * string under the initial press would throw that away.
 */
export function stringsCrossed(fromX: number, toX: number): HarpString[] {
  const lo = Math.min(fromX, toX);
  const hi = Math.max(fromX, toX);
  const hit = STRINGS.filter((s) => s.x > lo && s.x <= hi);
  return toX >= fromX ? hit : hit.reverse();
}

/** The string nearest a point, if the point is close enough to count. */
export function nearestString(x: number, tolerance = 0.045): HarpString | null {
  let best: HarpString | null = null;
  let bestDistance = Infinity;
  for (const s of STRINGS) {
    const d = Math.abs(s.x - x);
    if (d < bestDistance) {
      bestDistance = d;
      best = s;
    }
  }
  return best && bestDistance <= tolerance ? best : null;
}
