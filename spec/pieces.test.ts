import { describe, expect, it } from "vitest";
import { PIECES, durationOf } from "../pieces";
import { STRING_COUNT } from "../harp";
import { overtoneRatio } from "../string";

describe("the three demo pieces", () => {
  it("stays on the instrument", () => {
    for (const piece of PIECES) {
      expect(piece.notes.length).toBeGreaterThan(0);
      for (const note of piece.notes) {
        expect(note.index).toBeGreaterThanOrEqual(0);
        expect(note.index).toBeLessThan(STRING_COUNT);
        expect(note.position).toBeGreaterThanOrEqual(0);
        expect(note.position).toBeLessThanOrEqual(1);
        expect(note.force).toBeGreaterThan(0);
        expect(note.force).toBeLessThanOrEqual(1);
        expect(Number.isFinite(note.at)).toBe(true);
      }
    }
  });

  it("plays in the order it is written", () => {
    // The player reads notes off the front of the list, so a note out of
    // order is a note that never sounds.
    for (const piece of PIECES) {
      for (let i = 1; i < piece.notes.length; i++) {
        expect(piece.notes[i].at).toBeGreaterThanOrEqual(piece.notes[i - 1].at);
      }
    }
  });

  it("is short enough that nobody has to sit through it", () => {
    for (const piece of PIECES) {
      expect(durationOf(piece)).toBeGreaterThan(1);
      expect(durationOf(piece)).toBeLessThan(8);
    }
  });

  it("has three pieces with distinct ids", () => {
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    expect(PIECES.length).toBe(3);
  });

  it("makes the pluck position audible in the piece that promises to", () => {
    // "The same phrase, twice" claims the two halves are the same notes in a
    // different voice. If the two halves are not literally the same strings
    // in the same order, the claim is a lie; if their sound does not differ,
    // the piece demonstrates nothing.
    const piece = PIECES.find((p) => p.id === "position")!;
    const half = 6;
    const first = piece.notes.slice(0, half);
    const second = piece.notes.slice(half, half * 2);
    expect(second.map((n) => n.index)).toEqual(first.map((n) => n.index));
    const voice = (n: { position: number }) => overtoneRatio(n.position);
    for (let i = 0; i < half; i++) {
      expect(voice(second[i])).toBeGreaterThan(voice(first[i]) * 2);
    }
  });

  it("does not ask one string for two notes at the same instant", () => {
    // A string can only be in one state at a time, so a re-pluck cancels the
    // note already ringing. Two notes on one string at the same moment is
    // therefore one note and a wasted oscillator.
    for (const piece of PIECES) {
      const seen = new Set<string>();
      for (const note of piece.notes) {
        const key = `${note.index}@${note.at.toFixed(3)}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });
});
