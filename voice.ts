// The Web Audio side: turns a Strike into sound. Kept apart from membrane.ts
// so the physics can be tested without a browser, and apart from main.ts so
// the sound doesn't depend on how the drum is drawn.
import { partialsFor, type Strike } from "./membrane";

// Scheduled a hair ahead of now. Zero would mean "at whatever moment the
// audio thread next wakes", which is audible as a click on the attack; a few
// milliseconds is inaudible as latency and gives the envelope somewhere to
// start. See CLAUDE.md — the pointer-to-sound gap gets measured, not assumed.
const SCHEDULE_AHEAD_S = 0.004;
const ATTACK_S = 0.002;

export type Drum = {
  strike(strike: Strike): void;
  readonly context: AudioContext;
};

export function createDrum(context: AudioContext, destination: AudioNode = context.destination): Drum {
  // One shared bus, so many overlapping strikes can't sum past full scale and
  // clip. A drum you can hit fast is the point; a drum that distorts when you
  // do is not.
  const bus = context.createGain();
  bus.gain.value = 0.5;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.15;
  bus.connect(limiter).connect(destination);

  return {
    context,
    strike(strike: Strike) {
      const partials = partialsFor(strike);
      if (partials.length === 0) return;
      const t0 = context.currentTime + SCHEDULE_AHEAD_S;

      for (const partial of partials) {
        const osc = context.createOscillator();
        osc.type = "sine"; // the mode IS the sine; the timbre is which ones sound
        osc.frequency.value = partial.frequency;

        const env = context.createGain();
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(partial.amplitude, t0 + ATTACK_S);
        // Exponential, because a mode loses a fixed fraction of its energy per
        // cycle — a linear fade sounds like someone pulling a fader.
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + partial.decay);

        osc.connect(env).connect(bus);
        osc.start(t0);
        osc.stop(t0 + partial.decay + 0.05);
        // Let the graph go when the sound has. Without this every strike
        // leaks a node for as long as the page is open.
        osc.onended = () => {
          osc.disconnect();
          env.disconnect();
        };
      }
    },
  };
}
