// The physics of a struck circular membrane. Pure and DOM-free: no
// AudioContext, no canvas, no wall-clock reads — so it can be tested for what
// it claims about the instrument rather than for whether a browser noise came
// out. See CLAUDE.md.
//
// A drum head is not a string. A string's modes are integer multiples of its
// fundamental, which is why a plucked string has a pitch. A membrane's are
// not: they sit at the ratios of the zeros of Bessel functions, and that
// inharmonicity is exactly why an ordinary drum has no clear note.
//
// Which of those modes actually sound depends on where the head is struck.
// The displacement of mode (m,n) at radius r is proportional to
// J_m(j_mn · r/R): strike dead centre and only the axisymmetric m=0 modes
// move at all, because every m>0 mode has a node through the middle. Strike
// near the rim and the high modes come in. That is the instrument.

/** Zeros of the Bessel functions, j_mn. Frequencies go as j_mn / j_01. */
export type Mode = { m: number; n: number; zero: number };

export const MODES: readonly Mode[] = [
  { m: 0, n: 1, zero: 2.4048255576957728 },
  { m: 1, n: 1, zero: 3.8317059702075123 },
  { m: 2, n: 1, zero: 5.1356223018406826 },
  { m: 0, n: 2, zero: 5.5200781102863106 },
  { m: 3, n: 1, zero: 6.3801618959239835 },
  { m: 1, n: 2, zero: 7.0155866698156188 },
  { m: 4, n: 1, zero: 7.5883424345038044 },
  { m: 2, n: 2, zero: 8.4172441403998649 },
  { m: 0, n: 3, zero: 8.6537279129110122 },
  { m: 5, n: 1, zero: 8.7714838159599540 },
];

const FUNDAMENTAL_ZERO = MODES[0].zero;

/**
 * Bessel function of the first kind, by its defining power series:
 *
 *   J_m(x) = Σ_k (−1)^k / (k! (k+m)!) · (x/2)^(2k+m)
 *
 * Used rather than a polynomial approximation table because every argument
 * here is bounded by the largest zero above (~8.8), where the series is both
 * exact to double precision inside thirty terms and trivially checkable: each
 * mode's own Bessel function must vanish at its own zero, which is what the
 * tests assert.
 */
export function besselJ(m: number, x: number): number {
  let term = 1;
  for (let i = 1; i <= m; i++) term *= x / 2 / i; // (x/2)^m / m!
  let sum = term;
  for (let k = 1; k < 40; k++) {
    term *= (-(x * x) / 4) / (k * (k + m));
    sum += term;
    if (Math.abs(term) < 1e-15) break;
  }
  return sum;
}

export type Strike = {
  /** Distance from the centre, 0 at the middle to 1 at the rim. */
  radius: number;
  /** How hard, 0 to 1. */
  force: number;
};

export type Partial = {
  /** Hz. */
  frequency: number;
  /** Relative to the loudest partial in this strike, 0 to 1. */
  amplitude: number;
  /** Seconds to −60 dB. */
  decay: number;
};

export const FUNDAMENTAL_HZ = 92;

/**
 * Higher modes lose energy faster — a real head's radiation and internal
 * damping both rise with frequency, which is why the "ping" from a rim strike
 * dies long before the "thump" from the centre. Modelled as decay time
 * falling off with frequency ratio; the exponent is a feel parameter, not a
 * measured one, and is marked as such.
 */
const BASE_DECAY_S = 1.6;
const DECAY_FALLOFF = 1.35; // feel, not physics — tuned by ear

/**
 * Two factors that are physics, not feel, and without which a centre strike
 * comes out wrong. Measured before adding them: striking dead centre gave
 * modes 1.00x, 2.30x and 3.60x amplitude 1.00 each — a hollow three-note
 * chord, not a thump — because J_0(0) = 1 for every axisymmetric mode alike.
 *
 * 1. A drum is *struck*, so the initial condition is velocity, not
 *    displacement. Integrating an impulse over each mode leaves amplitude
 *    proportional to 1/ω. This is why the fundamental dominates a real thump.
 *
 * 2. A hand is not a point. Loading a disc of radius `a` weights each mode by
 *    the disc's own transform, 2·J_1(j·a/R)/(j·a/R), which falls away once a
 *    mode's wavelength is shorter than the contact patch. It is why a palm
 *    sounds dull and a fingertip sounds bright on the same spot.
 *
 * CONTACT_RADIUS is the one number here chosen by ear rather than derived —
 * it is a property of the striker, not the drum, and a later version could
 * make it a second expressive axis.
 */
const CONTACT_RADIUS = 0.3;

function discWeight(zero: number): number {
  const x = zero * CONTACT_RADIUS;
  if (x < 1e-9) return 1;
  return (2 * besselJ(1, x)) / x;
}

export function partialsFor(strike: Strike, fundamentalHz = FUNDAMENTAL_HZ): Partial[] {
  const r = Math.min(1, Math.max(0, strike.radius));
  const raw = MODES.map((mode) => {
    const ratio = mode.zero / FUNDAMENTAL_ZERO;
    // The amplitude of the mode at the strike point. cos(mθ) is 1 by
    // construction: the strike itself defines θ = 0, so every m gets its
    // radial weight and none is suppressed by an arbitrary choice of axis.
    const shape = Math.abs(besselJ(mode.m, mode.zero * r));
    const weight = (shape * Math.abs(discWeight(mode.zero))) / ratio;
    return {
      frequency: fundamentalHz * ratio,
      amplitude: weight,
      decay: BASE_DECAY_S / Math.pow(ratio, DECAY_FALLOFF),
    };
  });

  const loudest = Math.max(...raw.map((p) => p.amplitude));
  if (loudest <= 0) return [];
  const force = Math.min(1, Math.max(0, strike.force));
  return raw
    .map((p) => ({ ...p, amplitude: (p.amplitude / loudest) * force }))
    .filter((p) => p.amplitude > 0.004);
}

/**
 * How bright a strike is: the amplitude-weighted mean frequency ratio, in
 * multiples of the fundamental. One number, so "does the timbre actually
 * change across the head" is answerable rather than a matter of opinion —
 * the ear still decides whether the change is *enough*, but not whether it
 * exists.
 */
export function brightness(strike: Strike): number {
  const partials = partialsFor(strike);
  if (partials.length === 0) return 0;
  const total = partials.reduce((s, p) => s + p.amplitude, 0);
  const weighted = partials.reduce((s, p) => s + (p.amplitude * p.frequency) / FUNDAMENTAL_HZ, 0);
  return weighted / total;
}
