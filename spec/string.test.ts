import { overtoneRatio } from "../string";
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { HARMONICS, brightness, evenEnergy, harmonicAmplitude, partialsFor, shapeAt } from "../string";
import { STRINGS, STRING_COUNT, nearestString, pluckPosition, stringsCrossed } from "../harp";

describe("pluck position is the formula, not an approximation of it", () => {
  it("silences harmonic n exactly wherever the pluck lands on one of its nodes", () => {
    // The self-check: sin(nπp) is zero at p = k/n by construction, so if the
    // implementation were a fitted curve rather than the real expression
    // these would be merely small instead of vanishing.
    for (let n = 2; n <= 8; n++) {
      for (let k = 1; k < n; k++) {
        expect(Math.abs(harmonicAmplitude(n, k / n)), `harmonic ${n} at ${k}/${n}`).toBeLessThan(1e-12);
      }
    }
  });

  it("removes every even harmonic at the midpoint, and none near the end", () => {
    // The measurement that matters, and the one I had to go and find. The
    // spectral centre carried over from the drum work put the whole string at
    // a 1.76x range and made this look as weak as the drum I rejected by ear.
    // It was measuring the wrong thing: the midpoint is not darker, it is
    // missing a whole class of harmonic. 0% against 21% is a change of kind.
    expect(evenEnergy(0.5)).toBeLessThan(1e-9);
    expect(evenEnergy(0.08)).toBeGreaterThan(0.2);
  });

  it("brings the even harmonics back steadily as the pluck moves off centre", () => {
    let previous = -1;
    for (let p = 0.5; p >= 0.08; p -= 0.01) {
      const e = evenEnergy(p);
      expect(e, `even energy at p=${p.toFixed(2)}`).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = e;
    }
  });

  it("weights low harmonics far above high ones, as a corner in a string does", () => {
    // This used to read `partials[0].amplitude === 1`, which was not a fact
    // about strings but about my normalisation: dividing by the loudest
    // partial pins the fundamental at full scale wherever you pluck, and so
    // erases the loudness difference between the middle and the end. Energy
    // normalisation keeps that difference, and the real claim survives — the
    // fundamental is still the loudest thing in the note, and the top of the
    // stack is far below it.
    const partials = partialsFor(220, 0.12);
    const loudest = Math.max(...partials.map((q) => q.amplitude));
    expect(partials[0].amplitude).toBe(loudest);
    expect(partials[partials.length - 1].amplitude).toBeLessThan(partials[0].amplitude * 0.2);
  });

  it("never asks for a partial above hearing", () => {
    for (const p of partialsFor(880, 0.1)) expect(p.frequency).toBeLessThanOrEqual(16000);
    expect(partialsFor(220, 0.1).length).toBeLessThanOrEqual(HARMONICS);
  });

  it("mellows as it rings — high harmonics die first", () => {
    const partials = partialsFor(220, 0.12);
    for (let i = 1; i < partials.length; i++) {
      expect(partials[i].decay).toBeLessThan(partials[i - 1].decay);
    }
  });

  it("still reports a brightness, for the visuals to colour by", () => {
    expect(brightness(0.08)).toBeGreaterThan(brightness(0.5));
  });
});

describe("the string draws what it is doing", () => {
  it("is pinned at both ends, whatever the pluck", () => {
    for (const p of [0.1, 0.33, 0.5, 0.8]) {
      const shape = shapeAt(p, 0, 40);
      expect(Math.abs(shape[0])).toBeLessThan(1e-9);
      expect(Math.abs(shape[shape.length - 1])).toBeLessThan(1e-9);
    }
  });

  it("bulges nearest where it was actually plucked", () => {
    // The shape and the harmonic content are the same fact. If the drawing
    // ever stopped agreeing with the sound, the visual would be decoration.
    for (const p of [0.2, 0.5, 0.75]) {
      const shape = shapeAt(p, 0, 200);
      let peak = 0;
      for (let i = 0; i < shape.length; i++) if (Math.abs(shape[i]) > Math.abs(shape[peak])) peak = i;
      expect(peak / (shape.length - 1), `peak for pluck at ${p}`).toBeCloseTo(p, 1);
    }
  });
});

describe("a drag is a glissando", () => {
  it("plucks every string it crosses, not just the one it started on", () => {
    // The whole reason a harp works here where three drums did not: one
    // gesture becomes many overlapping notes.
    expect(stringsCrossed(0, 1).length).toBe(STRING_COUNT);
    expect(stringsCrossed(0.3, 0.7).length).toBeGreaterThan(2);
  });

  it("crosses them in the direction of travel", () => {
    const up = stringsCrossed(0, 1).map((s) => s.index);
    const down = stringsCrossed(1, 0).map((s) => s.index);
    expect(up[0]).toBeLessThan(up[up.length - 1]);
    expect(down[0]).toBeGreaterThan(down[down.length - 1]);
  });

  it("plucks nothing when the hand hasn't moved", () => {
    expect(stringsCrossed(0.5, 0.5)).toHaveLength(0);
  });
});

describe("there is no wrong string to land on", () => {
  it("tunes every pair to something consonant", () => {
    // Minor pentatonic: no minor second and no tritone anywhere in the set,
    // so a glissando across all eleven cannot produce a clash.
    for (const a of STRINGS) {
      for (const b of STRINGS) {
        const semis = Math.round(12 * Math.log2(b.frequency / a.frequency));
        const gap = ((semis % 12) + 12) % 12;
        expect([1, 6, 11], `${a.index} against ${b.index}`).not.toContain(gap);
      }
    }
  });

  it("rises from string to string, and spans two octaves", () => {
    for (let i = 1; i < STRINGS.length; i++) {
      expect(STRINGS[i].frequency).toBeGreaterThan(STRINGS[i - 1].frequency);
    }
    const span = STRINGS[STRINGS.length - 1].frequency / STRINGS[0].frequency;
    expect(span).toBeGreaterThan(3.5);
  });

  it("gives every string its own key", () => {
    const keys = STRINGS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => k.length === 1)).toBe(true);
  });

  it("reads a position along the string from top anchor to bottom", () => {
    expect(pluckPosition(0.06)).toBeCloseTo(0, 6);
    expect(pluckPosition(0.94)).toBeCloseTo(1, 6);
    expect(pluckPosition(0.5)).toBeGreaterThan(0.4);
  });

  it("finds a string only when the hand is near one", () => {
    expect(nearestString(STRINGS[3].x)?.index).toBe(3);
    expect(nearestString(0.5 * (STRINGS[3].x + STRINGS[4].x), 0.01)).toBeNull();
  });
});

// Added after playing it. The measurements below all passed while the
// instrument sounded, to the player, like one note.
describe("what actually reaches the ear", () => {
  it("has overtones loud enough for their absence to be audible", () => {
    // The ear hears the force the string exerts on the bridge, not the
    // string's displacement — and that is a different spectrum, one factor of
    // n brighter. Under the displacement spectrum the whole overtone stack
    // sits 3-18 dB below the fundamental, so every pluck is very nearly a
    // sine wave and removing the even harmonics removes almost nothing. The
    // holes are real; there was just nothing in them.
    const nearEnd = overtoneRatio(0.06);
    expect(nearEnd).toBeGreaterThan(1);
    // ...and the middle must still be the hollow end of the range.
    expect(overtoneRatio(0.5)).toBeLessThan(nearEnd / 2);
  });

  it("does not give the two halves of a string the same sound", () => {
    // sin(nπp) is symmetric about the midpoint, so p and 1-p are the same
    // spectrum to the last digit. A hand travelling down a string therefore
    // hears hollow-bright-hollow-bright: half an instrument, played twice.
    // A real harp has a soundboard at one end and nothing but a tuning pin at
    // the other, and harpists play "près de la table" precisely because that
    // end sounds different.
    for (const p of [0.15, 0.3]) {
      const near = partialsFor(220, p);
      const far = partialsFor(220, 1 - p);
      const ring = (ps: { decay: number }[]) => Math.max(...ps.map((q) => q.decay));
      const difference = Math.abs(ring(near) - ring(far)) / ring(far);
      expect(difference).toBeGreaterThan(0.15);
    }
  });
});
