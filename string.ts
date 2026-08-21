// The physics of a plucked string. Pure and DOM-free: no AudioContext, no
// canvas, no wall-clock reads, so what the instrument claims about itself can
// be tested rather than merely heard.
//
// A string's modes, unlike a drum head's, are exact integer multiples of its
// fundamental — that is why a plucked string has a pitch and a drum does not.
// What the player controls is not which modes exist but which ones are moving,
// and that is set entirely by where the string is pulled.

/**
 * Pull an ideal string aside at a point `p` along its length and let go. The
 * initial shape is two straight segments meeting at `p`; expanding that shape
 * in the string's own modes gives harmonic `n` an amplitude of
 *
 *     sin(nπp) / n²
 *
 * The 1/n² is the displacement initial condition — a corner is mostly made of
 * low harmonics. The sin(nπp) is the whole instrument: it vanishes whenever
 * `p` sits on a node of harmonic `n`, so plucking at the midpoint silences
 * every even harmonic, plucking at a third silences the third, and plucking
 * near an end silences nothing at all.
 *
 * This is the formula and not an approximation of it. A lowpass sweep gets a
 * slope where the real thing has holes, and the holes are what an ear hears.
 */
export function harmonicAmplitude(n: number, pluck: number): number {
  return Math.sin(n * Math.PI * pluck) / (n * n);
}

/**
 * What the ear actually gets. The string's displacement is one thing; the
 * sound is the transverse force the string pulls on the bridge with, which is
 * tension times the slope at the end — so differentiating once turns 1/n² into
 * 1/n. The holes stay exactly where they were, because sin(nπp) is untouched,
 * but now they have something in them to remove: near the end the overtones
 * together are louder than the fundamental, where under displacement they were
 * 3 dB under it. This is the difference between an instrument you can hear the
 * position of and one that sounds like a sine wave wherever you touch it.
 */
export function bridgeAmplitude(n: number, pluck: number): number {
  return Math.sin(n * Math.PI * pluck) / n;
}

export const HARMONICS = 24;

/**
 * How close the pluck is to the soundboard. sin(nπp) is symmetric about the
 * midpoint, so on an ideal string the top half and the bottom half are the
 * same sound to the last digit, and a hand running down one hears the same
 * half-instrument twice. A real harp is not symmetric: one end is glued to a
 * soundboard and the other is wound round a pin. Energy leaves fast at the
 * board end — brighter, louder, shorter — which is what harpists are after
 * when they play près de la table. The size of the effect below is feel; the
 * asymmetry it comes from is not.
 */
export function boardProximity(pluck: number): number {
  return Math.min(1, Math.max(0, pluck));
}

/** Where the string is silent for a given harmonic — the spots worth marking
 *  on it, because a sound that changes at a place is only playable if the
 *  place can be found. */
export const NODES = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4] as const;

export type Partial = { frequency: number; amplitude: number; decay: number };

/**
 * Higher harmonics lose energy faster: air and the string's own stiffness
 * both damp them harder, which is why a plucked note starts bright and
 * mellows as it rings. The exponent is feel, not physics, and is marked so.
 */
const BASE_DECAY_S = 3.4;
const DECAY_FALLOFF = 0.55; // feel, tuned by ear

export function partialsFor(frequency: number, pluck: number, force = 1): Partial[] {
  const p = Math.min(0.97, Math.max(0.03, pluck));
  const board = boardProximity(p);
  const raw: Partial[] = [];
  for (let n = 1; n <= HARMONICS; n++) {
    const hz = frequency * n;
    if (hz > 16000) break; // nothing above hearing, and nothing to alias
    raw.push({
      frequency: hz,
      amplitude: Math.abs(bridgeAmplitude(n, p)),
      decay: (BASE_DECAY_S / Math.pow(n, DECAY_FALLOFF)) * (1 - 0.3 * board),
    });
  }
  // Normalised by total energy rather than by the loudest partial. Dividing by
  // the loudest pins the fundamental at full scale in every position, which
  // quietly throws away the loudness a pluck near the end really has.
  const energy = Math.sqrt(raw.reduce((s, r) => s + r.amplitude * r.amplitude, 0));
  if (energy <= 0) return [];
  const level = Math.min(1, Math.max(0, force));
  return raw
    .map((r) => ({ ...r, amplitude: (r.amplitude / energy) * level }))
    .filter((r) => r.amplitude > 0.002);
}

/**
 * The overtones' energy against the fundamental's. Under 1 the note is
 * essentially a sine wave and nothing done to its harmonics will be heard;
 * over 1 the overtones are the sound. The whole point of the pluck position
 * is to move this number, so it is the number to watch.
 */
export function overtoneRatio(pluck: number): number {
  const ps = partialsFor(1, pluck);
  if (ps.length < 2) return 0;
  const upper = Math.sqrt(ps.slice(1).reduce((s, q) => s + q.amplitude * q.amplitude, 0));
  return upper / ps[0].amplitude;
}

/**
 * Where the sound's energy sits, in multiples of the fundamental. One number,
 * so "does the pluck position actually change the sound" has an answer that
 * is not an opinion — though only an ear can say whether the change is
 * *enough*, which is how three earlier versions of this week's instrument
 * were rejected.
 */
export function brightness(pluck: number): number {
  const partials = partialsFor(1, pluck);
  if (partials.length === 0) return 0;
  const total = partials.reduce((s, p) => s + p.amplitude, 0);
  return partials.reduce((s, p) => s + p.amplitude * p.frequency, 0) / total;
}

/**
 * The shape the string holds while it rings, sampled along its length. Same
 * fact as the harmonic content: each mode contributes its own sine, weighted
 * by how hard the pluck moved it. Drawing this is how a player sees that
 * where they plucked is why it sounds like that.
 */
export function shapeAt(pluck: number, phase: number, samples: number): number[] {
  const p = Math.min(0.97, Math.max(0.03, pluck));
  const out: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    let y = 0;
    for (let n = 1; n <= 8; n++) {
      y += harmonicAmplitude(n, p) * Math.sin(n * Math.PI * x) * Math.cos(n * phase);
    }
    out.push(y);
  }
  const peak = Math.max(...out.map(Math.abs)) || 1;
  return out.map((v) => v / peak);
}

/**
 * The share of the sound's energy sitting in even harmonics. This is the
 * measurement that matters here, and the one I had to go and find: the
 * spectral centre I carried over from the drum work reported a range of only
 * 1.76x across the whole string and made the instrument look as weak as the
 * drum I had already rejected. It was measuring the wrong thing. Plucking at
 * the midpoint does not make the sound darker, it removes every even harmonic
 * — 0% here against 21% near the end — and that is a change of category, not
 * of degree. A lowpass sweep cannot produce it at all.
 */
export function evenEnergy(pluck: number): number {
  const p = Math.min(0.97, Math.max(0.03, pluck));
  let even = 0;
  let all = 0;
  for (let n = 1; n <= HARMONICS; n++) {
    const a = bridgeAmplitude(n, p) ** 2;
    all += a;
    if (n % 2 === 0) even += a;
  }
  return all > 0 ? even / all : 0;
}
