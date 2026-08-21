# Process overview

## What I built

A harp of eleven strings, flat on. Which string you pluck is the note; where
along it you pluck is the sound. That second control is the whole prototype:
an ideal string plucked at `p` gives harmonic `n` an amplitude of
`sin(nπp)/n`, so the midpoint silences every even harmonic and the ends bring
them all back. It is derived, not a filter sweep. The strings are pentatonic,
so there is nothing to play wrong, and three public-domain tunes are scheduled
through the same synthesis rather than played back.

## The moments that mattered

**My ear failed four instruments that every measurement had passed.** A drum,
a kit, a djembe and an arpeggiator all measured fine and all sounded like one
note wherever you hit them, and so did the first harp. Rather than tune it
again I made the ear's complaint into two assertions and committed them red
([`f5152c8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-Anson0028/commit/f5152c8)). They found two real faults: I was
synthesising the string's displacement, where the ear hears the force on the
bridge — one factor of `n` brighter, which moved the overtone stack from
18 dB under the fundamental to 8 dB over it — and `sin(nπp)` is symmetric, so
the top and bottom halves of every string were the same sound
([`6fe7dc2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-Anson0028/commit/6fe7dc2)).

**A sentence in `CLAUDE.md` had been decoration for four weeks.** It said the
pointer-to-sound gap here is measured, not assumed. Nothing measured it. The
sensor I wrote passed at 27 ms — until I read the parts and saw 24 of them
belonged to the CI machine's audio device, so the assertion was grading a
sound card. The ceiling now sits on the 2 ms the page owns
([`dee0a03...96c16bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-Anson0028/compare/dee0a03...96c16bd)).
