// The Web Audio side: turns a pluck into sound. Kept apart from string.ts so
// the physics is testable without a browser, and apart from main.ts so the
// sound doesn't depend on how the harp is drawn.
import { partialsFor } from "./string";
import type { HarpString } from "./harp";

// Scheduled a hair ahead of now. Zero means "whenever the audio thread next
// wakes", which is audible as a click on the attack; a few milliseconds is
// inaudible as latency and gives the envelope somewhere to start. The
// pointer-to-sound gap is measured, not assumed — see CLAUDE.md.
const SCHEDULE_AHEAD_S = 0.0015;
const ATTACK_S = 0.004;

export type Harp = {
  /** `lead` schedules the pluck that many seconds ahead, so a written piece
   *  can be handed to the audio clock in one go instead of being chased with
   *  timers. setTimeout is not a musical instrument. */
  pluck(string: HarpString, position: number, force?: number, lead?: number): number;

  /** What the browser will admit to between a scheduled time and a speaker
   *  moving. Not the whole story — the OS and the hardware add their own —
   *  but it is the part that can be read rather than guessed. */
  readonly outputLatencyS: number;
  /** A palm on the strings. Everything ringing stops, quickly but not abruptly. */
  damp(): void;
  readonly context: AudioContext;
};

export function createHarp(context: AudioContext, destination: AudioNode = context.destination): Harp {
  const bus = context.createGain();
  bus.gain.value = 0.3;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.ratio.value = 10;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  bus.connect(limiter).connect(destination);

  // The soundbox. A harp is a box with a hole in it, and without some space
  // around the strings a glissando is eleven separate beeps rather than one
  // gesture.
  const wet = context.createGain();
  wet.gain.value = 0.22;
  const delay = context.createDelay(1);
  delay.delayTime.value = 0.13;
  const feedback = context.createGain();
  feedback.gain.value = 0.3;
  const damp = context.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 3200;
  wet.connect(delay).connect(damp).connect(feedback).connect(delay);
  damp.connect(bus);

  // Every ringing string, so a palm can stop them and so a re-pluck silences
  // the note already sounding on that string rather than stacking on it.
  const ringing = new Map<number, GainNode[]>();

  function stop(gains: GainNode[], at: number, over: number): void {
    for (const g of gains) {
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + over);
    }
  }

  return {
    context,
    damp() {
      const now = context.currentTime;
      for (const gains of ringing.values()) stop(gains, now, 0.12);
      ringing.clear();
    },
    get outputLatencyS() {
      const c = context as AudioContext & { outputLatency?: number };
      return c.outputLatency || c.baseLatency || 0;
    },
    pluck(string, position, force = 1, lead = 0) {
      const partials = partialsFor(string.frequency, position, force);
      if (partials.length === 0) return context.currentTime;
      const t0 = context.currentTime + SCHEDULE_AHEAD_S + Math.max(0, lead);

      // A real string can only be in one state at a time. Without this, a fast
      // glissando back and forth stacks a dozen copies of the same note and
      // the page turns to mud.
      const previous = ringing.get(string.index);
      if (previous) stop(previous, t0, 0.05);

      const gains: GainNode[] = [];
      for (const p of partials) {
        const osc = context.createOscillator();
        osc.type = "sine"; // the harmonic IS the sine; the timbre is which ones sound
        osc.frequency.value = p.frequency;
        const env = context.createGain();
        env.gain.setValueAtTime(0, t0);
        env.gain.linearRampToValueAtTime(p.amplitude * 0.5, t0 + ATTACK_S);
        // Exponential: a harmonic loses a fixed fraction of its energy per
        // cycle. A linear fade sounds like someone pulling a fader.
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
        osc.connect(env);
        env.connect(bus);
        env.connect(wet);
        osc.start(t0);
        osc.stop(t0 + p.decay + 0.1);
        osc.onended = () => {
          osc.disconnect();
          env.disconnect();
        };
        gains.push(env);
      }
      ringing.set(string.index, gains);

      // The finger leaving the string. Brief, quiet, and brighter the nearer
      // the pluck is to an end — without it every note begins out of nowhere.
      const nail = context.createOscillator();
      nail.type = "triangle";
      nail.frequency.value = string.frequency * (6 + (1 - Math.abs(position - 0.5) * 2) * 4);
      const nailEnv = context.createGain();
      nailEnv.gain.setValueAtTime(0, t0);
      nailEnv.gain.linearRampToValueAtTime(0.05 * force, t0 + 0.001);
      nailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
      nail.connect(nailEnv).connect(bus);
      nail.start(t0);
      nail.stop(t0 + 0.05);
      nail.onended = () => {
        nail.disconnect();
        nailEnv.disconnect();
      };

      // Handed back so the page can measure the gap between the hand and the
      // sound instead of assuming it.
      return t0;
    },
  };
}
