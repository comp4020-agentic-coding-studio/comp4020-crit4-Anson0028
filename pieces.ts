// Three tunes to press before you know what the instrument does. A stranger
// who drags a hand across eleven strings gets a pleasant noise and learns
// nothing about the pluck position, which is the only control here worth
// learning.
//
// All three are traditional and out of copyright, and all three are
// pentatonic — which is not a coincidence but the reason they fit. The
// strings are tuned to a pentatonic scale so that a stranger cannot land on a
// wrong note, and the tunes people the world over already know by heart turn
// out to live in exactly that scale. A harp with no wrong notes can play
// Amazing Grace note for note and never leave home.
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

// The strings, as scale degrees. 0 is the low A; the rest are the pentatonic
// steps above it. Naming them is how a tune stays readable as a tune.
const A3 = 0;
const C4 = 1;
const D4 = 2;
const E4 = 3;
const G4 = 4;
const A4 = 5;
const C5 = 6;
const D5 = 7;
const E5 = 8;
const G5 = 9;
const A5 = 10;

/** A rest. */
const _ = -1;

type Step = readonly [index: number, beats: number];

type LineOptions = { beat: number; start: number; position: number; force?: number };

/** Lay a melody out in time. Returns the notes and where the line ends, so the
 *  next line can start there without a magic number. */
function line(steps: readonly Step[], o: LineOptions): { notes: Note[]; end: number } {
  const notes: Note[] = [];
  let t = o.start;
  for (const [index, beats] of steps) {
    if (index !== _) notes.push({ at: t, index, position: o.position, force: o.force ?? 0.85 });
    t += beats * o.beat;
  }
  return { notes, end: t };
}

// ---------------------------------------------------------------------------
// 1. Amazing Grace (New Britain, 1835). Its first phrase is repeated, and the
//    repeat is played by the soundboard — so the piece that shows off the
//    pluck position does it inside a tune everybody knows, with the same
//    notes in the same order, rather than in an exercise nobody would listen
//    to twice.
const GRACE_PHRASE: readonly Step[] = [
  [G4, 1],
  [C5, 2], [E5, 1],
  [C5, 2], [E5, 1],
  [D5, 3],
  [C5, 2], [A4, 1],
  [G4, 3],
];

const grace: Piece = (() => {
  const beat = 0.36;
  const near = line(GRACE_PHRASE, { beat, start: 0, position: 0.5, force: 0.85 });
  const far = line(GRACE_PHRASE, { beat, start: near.end + beat, position: 0.9, force: 0.85 });
  return {
    id: "grace",
    title: "Amazing Grace",
    about: "The opening line twice over — the same notes in the same order, plucked at the middle of the strings and then down by the soundboard.",
    notes: [...near.notes, ...far.notes],
  };
})();

// ---------------------------------------------------------------------------
// 2. Jasmine Flower (Mo Li Hua, Jiangsu, Qing dynasty). Two phrases that are
//    almost the same, which is the whole charm of it — and a second chance to
//    hear one hand height against another without inventing an exercise.
const JASMINE_A: readonly Step[] = [
  [E4, 1], [E4, 1], [G4, 1], [A4, 1],
  [G4, 1], [E4, 1], [G4, 2],
];
const JASMINE_B: readonly Step[] = [
  [A4, 1], [A4, 1], [A4, 1], [G4, 1],
  [A4, 1], [C5, 1], [A4, 1], [G4, 1],
  [E4, 1], [G4, 1], [E4, 1], [D4, 1],
  [C4, 4],
];

const jasmine: Piece = (() => {
  const beat = 0.3;
  const first = line(JASMINE_A, { beat, start: 0, position: 0.45, force: 0.8 });
  const again = line(JASMINE_A, { beat, start: first.end, position: 0.72, force: 0.8 });
  const rest = line(JASMINE_B, { beat, start: again.end, position: 0.82, force: 0.85 });
  return {
    id: "jasmine",
    title: "Jasmine Flower",
    about: "A Jiangsu folk song, pentatonic to the last note — which is why it fits these strings without a single accidental.",
    notes: [...first.notes, ...again.notes, ...rest.notes],
  };
})();

// ---------------------------------------------------------------------------
// 3. Auld Lang Syne (traditional, Burns 1788). The hand climbs towards the
//    board across the phrase, so it opens out without a single note changing.
const AULD: readonly Step[] = [
  [G4, 1],
  [C5, 3], [C5, 1],
  [C5, 2], [E5, 1],
  [D5, 2], [C5, 1],
  [D5, 2], [E5, 1],
  [C5, 2], [C5, 1],
  [E5, 2], [G5, 1],
  [A5, 4],
];

const auld: Piece = (() => {
  const beat = 0.3;
  const notes = AULD.reduce<{ notes: Note[]; t: number; i: number }>(
    (acc, [index, beats]) => {
      const climb = 0.5 + (acc.i / (AULD.length - 1)) * 0.38;
      acc.notes.push({ at: acc.t, index, position: climb, force: 0.85 });
      // A low string under the start of each phrase, so there is a bass to
      // play over rather than a bare melody.
      if (acc.i === 1 || acc.i === 7) acc.notes.push({ at: acc.t, index: A3, position: 0.6, force: 0.55 });
      return { notes: acc.notes, t: acc.t + beats * beat, i: acc.i + 1 };
    },
    { notes: [], t: 0, i: 0 },
  ).notes;
  return {
    id: "auld",
    title: "Auld Lang Syne",
    about: "The one everybody already knows, with the hand walking down towards the soundboard as it goes.",
    notes: notes.sort((a, b) => a.at - b.at),
  };
})();

export const PIECES: readonly Piece[] = [grace, jasmine, auld];

/** How long a piece runs, in seconds — up to its last note. */
export function durationOf(piece: Piece): number {
  return Math.max(...piece.notes.map((n) => n.at));
}

/** The repeated phrase in "Amazing Grace", as string indices. The point of
 *  that piece is that the two halves are the same notes; this is what the
 *  test compares them against. */
export const GRACE_PHRASE_INDICES: readonly number[] = GRACE_PHRASE.map(([i]) => i).filter((i) => i !== _);

export { STRING_COUNT };
