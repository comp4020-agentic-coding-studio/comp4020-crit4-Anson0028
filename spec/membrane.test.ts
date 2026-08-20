// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MODES, besselJ, brightness, partialsFor } from "../membrane";

describe("the Bessel series is right, and can prove it", () => {
  // Not a golden-value test: every mode in the table is defined as a zero of
  // its own Bessel function, so the implementation has to make its own table
  // vanish. If the series were wrong the table would not be self-consistent.
  it("vanishes at every zero the mode table is built from", () => {
    for (const mode of MODES) {
      expect(Math.abs(besselJ(mode.m, mode.zero)), `J_${mode.m}(${mode.zero})`).toBeLessThan(1e-9);
    }
  });

  it("matches the values at zero that define the functions", () => {
    expect(besselJ(0, 0)).toBeCloseTo(1, 12);
    expect(besselJ(1, 0)).toBeCloseTo(0, 12);
    expect(besselJ(5, 0)).toBeCloseTo(0, 12);
    // Standard reference values.
    expect(besselJ(0, 1)).toBeCloseTo(0.7651976866, 9);
    expect(besselJ(1, 1)).toBeCloseTo(0.4400505857, 9);
  });
});

describe("where you strike is the instrument", () => {
  it("gives a centre strike only the axisymmetric modes", () => {
    // Every m>0 mode has a node through the middle, so a strike there cannot
    // move them at all. If this ever fails, the position has stopped meaning
    // anything and the whole instrument is a single sound.
    const partials = partialsFor({ radius: 0, force: 1 });
    const centreModes = MODES.filter((mode) => mode.m === 0).map((mode) => mode.zero / MODES[0].zero);
    for (const p of partials) {
      const ratio = p.frequency / partialsFor({ radius: 0, force: 1 })[0].frequency;
      expect(centreModes.some((r) => Math.abs(r - ratio) < 1e-6), `ratio ${ratio.toFixed(3)} is axisymmetric`).toBe(
        true,
      );
    }
  });

  it("gets brighter the further out you strike", () => {
    const centre = brightness({ radius: 0, force: 1 });
    const middle = brightness({ radius: 0.5, force: 1 });
    const rim = brightness({ radius: 0.92, force: 1 });

    expect(middle).toBeGreaterThan(centre);
    expect(rim).toBeGreaterThan(middle);
    // Not merely ordered — apart. A monotonic function whose whole range is a
    // few percent would pass an ordering test and sound identical.
    //
    // 1.4 is measured, not chosen: centre reads 1.49 and rim 2.16 in
    // multiples of the fundamental, a ratio of 1.45. I first asserted 1.5 out
    // of thin air and it failed at 1.21 — which is how the two missing
    // excitation factors got found, so the wrong guess earned its keep. This
    // number is a floor under a measurement now, and whether 1.45 is *enough*
    // is still a question only the ear can answer.
    expect(rim / centre).toBeGreaterThan(1.4);
  });

  it("has no audible dead zone to stumble into on the way out", () => {
    // Not strictly monotonic, and pretending otherwise would be a fiction:
    // as the strike moves out, the (0,2) mode crosses its own node and comes
    // back inverted while (1,1) is still rising, so the sum wobbles. Measured
    // across the whole head in 0.005 steps, the worst reversal is 0.2% at
    // r=0.275, against a full range of 1.49 to 2.16. A fifth of one percent
    // is not a dead zone; a reversal ten times that would be, and this test
    // exists to catch that, not to assert a monotonicity the physics does not
    // have.
    const WORST_TOLERABLE_REVERSAL = 0.005;
    let previous = -Infinity;
    for (let r = 0; r <= 0.95; r += 0.005) {
      const b = brightness({ radius: r, force: 1 });
      if (previous > -Infinity) {
        expect((previous - b) / previous, `reversal at r=${r.toFixed(3)}`).toBeLessThan(WORST_TOLERABLE_REVERSAL);
      }
      previous = b;
    }
  });

  it("scales with force and never sounds at zero force", () => {
    const hard = partialsFor({ radius: 0.5, force: 1 });
    const soft = partialsFor({ radius: 0.5, force: 0.25 });
    expect(soft[0].amplitude).toBeCloseTo(hard[0].amplitude * 0.25, 6);
    expect(partialsFor({ radius: 0.5, force: 0 })).toHaveLength(0);
  });

  it("decays the high modes faster than the low ones", () => {
    const partials = partialsFor({ radius: 0.9, force: 1 });
    const sorted = [...partials].sort((a, b) => a.frequency - b.frequency);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].decay).toBeLessThan(sorted[i - 1].decay);
    }
  });
});
