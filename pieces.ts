// Three things to press before you know what the instrument does. A stranger
// who drags a hand across the strings gets a nice noise and learns nothing
// about the one control that matters, so each piece exists to make one fact
// audible and then hand the strings back.
//
// Pure data and pure functions: no audio, no canvas, no clock. What a piece
// claims — that it stays on the instrument, that it really does contrast the
// thing it says it contrasts — is checked rather than assumed.
import { STRING_COUNT } from "./harp";

export type Note = {
  /** Seconds from the start of the piece. */
  at: number;
  /** Which string, 0 at the left. */
  index: number;
  /** Where along it, 0 at the neck and 1 at the soundboard. */
  position: number;
  force: number;
};

export type Piece = {
  id: string;
  title: string;
  /** What this one is for. Shown, because a demo that teaches nothing is a jingle. */
  about: string;
  notes: Note[];
};

const MIDDLE = 0.5;
const TABLE = 0.9; // by the soundboard
const NECK = 0.1;

function phrase(steps: number[], start: number, gap: number, position: number, force: number): Note[] {
  return steps.map((index, i) => ({ at: start + i * gap, index, position, force }));
}

// 1. The same six notes twice over, moving only the hand's height. Nothing
//    else changes: same strings, same order, same speed. If the second half
//    does not sound like a different instrument then the pluck position is
//    not doing its job, and three earlier instruments were rejected this week
//    for exactly that.
const sameNotesTwice: Piece = {
  id: "position",
  title: "The same phrase, twice",
  about: "Identical notes. The only difference is how high up the string the hand is: the middle first, then down by the soundboard.",
  notes: [
    ...phrase([0, 2, 4, 5, 4, 2], 0, 0.36, MIDDLE, 0.9),
    ...phrase([0, 2, 4, 5, 4, 2], 2.5, 0.36, TABLE, 0.9),
    { at: 4.8, index: 0, position: MIDDLE, force: 0.8 },
    { at: 4.8, index: 5, position: TABLE, force: 0.8 },
  ],
};

// 2. What a hand does when it just falls across the strings, which is the
//    first thing anybody tries. Up, down, and then up again with the hand
//    sliding from the neck to the board, so the sweep brightens as it climbs.
const sweep: Piece = {
  id: "sweep",
  title: "A hand across the strings",
  about: "A glissando up and back, then a third one where the hand slides down towards the soundboard as it goes.",
  notes: [
    ...Array.from({ length: STRING_COUNT }, (_, i) => ({ at: i * 0.06, index: i, position: 0.42, force: 0.75 })),
    ...Array.from({ length: STRING_COUNT }, (_, i) => ({
      at: 0.95 + i * 0.055,
      index: STRING_COUNT - 1 - i,
      position: 0.42,
      force: 0.7,
    })),
    ...Array.from({ length: STRING_COUNT }, (_, i) => ({
      at: 1.9 + i * 0.075,
      index: i,
      position: NECK + (i / (STRING_COUNT - 1)) * (TABLE - NECK),
      force: 0.85,
    })),
    { at: 3.0, index: 10, position: TABLE, force: 1 },
  ],
};

// 3. An actual tune, so the answer to "what is this for" is a piece of music
//    and not a demonstration. Melody up top, a low note under each bar, and
//    the melody drifts up the string as it goes so the phrase opens out.
const tune: Piece = {
  id: "tune",
  title: "Something to take over",
  about: "A short piece in the strings' own scale. Play along on top of it, or press it again when it stops.",
  notes: (() => {
    const out: Note[] = [];
    const beat = 0.3;
    const melody = [7, 8, 9, 8, 7, 5, 7, 0, 5, 7, 8, 7, 5, 4, 5, 0];
    melody.forEach((index, i) => {
      const t = i * beat;
      // The hand climbs from the middle towards the board across the tune, so
      // the second half is brighter than the first without a single note
      // changing.
      const position = MIDDLE + (i / (melody.length - 1)) * (TABLE - MIDDLE);
      out.push({ at: t, index, position, force: 0.85 });
      if (i % 4 === 0) out.push({ at: t, index: i % 8 === 0 ? 0 : 2, position: 0.62, force: 0.6 });
    });
    out.push({ at: melody.length * beat + 0.1, index: 0, position: 0.62, force: 0.8 });
    out.push({ at: melody.length * beat + 0.1, index: 5, position: 0.55, force: 0.7 });
    return out.sort((a, b) => a.at - b.at);
  })(),
};

export const PIECES: readonly Piece[] = [sameNotesTwice, sweep, tune];

/** How long a piece runs, in seconds — the last note plus its ring. */
export function durationOf(piece: Piece): number {
  return Math.max(...piece.notes.map((n) => n.at));
}
