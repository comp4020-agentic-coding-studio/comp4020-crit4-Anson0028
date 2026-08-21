// The harp you can see and play. The physics lives in ./string (pure), the
// layout in ./harp (pure), the sound in ./voice; this file is the drawing,
// the input, and nothing else.
import { NODES, boardProximity, evenEnergy, overtoneRatio, shapeAt } from "./string";
import { BOTTOM, STRINGS, TOP, nearestString, pluckPosition, stringsCrossed, type HarpString } from "./harp";
import { createHarp, type Harp } from "./voice";

const mount = document.querySelector<HTMLElement>("#harp");

if (mount) {
  const canvas = document.createElement("canvas");
  canvas.dataset.testid = "harp";
  canvas.setAttribute("role", "application");
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute(
    "aria-label",
    "A harp of eleven strings. Click or drag across them to pluck; dragging plays a glissando. Where you pluck along a string changes its sound — the middle is hollow, the ends are bright. Keys A to apostrophe pluck each string; hold shift for a brighter pluck.",
  );
  mount.append(canvas);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.dataset.testid = "hint";
  hint.textContent = "Drag across the strings.  ·  the middle of a string is hollow, the ends are bright, and the end by the soundboard is brightest";
  mount.append(hint);

  const mirror = document.createElement("div");
  mirror.dataset.testid = "harp-state";
  mirror.hidden = true;
  mirror.dataset.plucks = "0";
  mount.append(mirror);

  const ctx = canvas.getContext("2d");
  let cssWidth = 0;
  let cssHeight = 0;

  function resize(): void {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);

  type Ringing = { string: HarpString; position: number; born: number; force: number };
  const ringing = new Map<number, Ringing>();
  const RING_MS = 3400;

  let harp: Harp | null = null;
  let plucks = 0;

  // Suspended until a real gesture, per the autoplay policy and per the rule
  // in CLAUDE.md: nothing sounds before the player asks for a sound.
  function ensureAudio(): Harp {
    if (!harp) {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      harp = createHarp(new Ctor());
    }
    if (harp.context.state === "suspended") void harp.context.resume();
    return harp;
  }

  function pluck(string: HarpString, position: number, force = 1): void {
    ensureAudio().pluck(string, position, force);
    ringing.set(string.index, { string, position, born: performance.now(), force });
    plucks++;
    mirror.dataset.plucks = String(plucks);
    mirror.dataset.lastString = String(string.index);
    mirror.dataset.lastPosition = position.toFixed(4);
    mirror.dataset.lastEvenEnergy = evenEnergy(position).toFixed(4);
  }

  type Hand = { x: number; y: number; locked: { index: number; x: number } | null };
  const hands = new Map<number, Hand>();

  // A finger crossing a string deflects it and lets it go. Wobble inside that
  // deflection does not release it a second time — physically the string is
  // already moving, and musically eighty-five notes in one sweep is a rake on
  // a fence. So a string that just sounded stays locked until the hand is
  // clearly past it: about half the gap to its neighbour.
  const RELEASE = 0.04;

  function local(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / Math.max(1, cssWidth), y: (e.clientY - rect.top) / Math.max(1, cssHeight) };
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.focus();
    canvas.setPointerCapture(e.pointerId);
    const at = local(e);
    const string = nearestString(at.x);
    hands.set(e.pointerId, { ...at, locked: string ? { index: string.index, x: string.x } : null });
    if (string) pluck(string, pluckPosition(at.y), e.pointerType === "mouse" ? 1 : Math.max(0.4, e.pressure * 1.6 || 0.9));
  });

  canvas.addEventListener("pointermove", (e) => {
    const previous = hands.get(e.pointerId);
    if (!previous) return;
    const at = local(e);
    let locked = previous.locked;
    if (locked && Math.abs(at.x - locked.x) > RELEASE) locked = null;
    // Every string the hand crossed, in the order it crossed them — a drag is
    // a glissando, which is the whole reason this instrument works where three
    // drums did not.
    for (const string of stringsCrossed(previous.x, at.x)) {
      if (locked && string.index === locked.index) continue;
      pluck(string, pluckPosition(at.y), 0.85);
      locked = { index: string.index, x: string.x };
    }
    hands.set(e.pointerId, { ...at, locked });
  });

  function lift(e: PointerEvent): void {
    hands.delete(e.pointerId);
  }
  canvas.addEventListener("pointerup", lift);
  canvas.addEventListener("pointercancel", lift);

  canvas.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " ") {
      e.preventDefault();
      ensureAudio().damp();
      ringing.clear();
      return;
    }
    const string = STRINGS.find((s) => s.key === e.key.toLowerCase());
    if (!string) return;
    e.preventDefault();
    // Shift is the other hand moving up the string: the same note, plucked
    // near the end instead of the middle. The keyboard gets the instrument's
    // one real dimension, not just its notes.
    pluck(string, e.shiftKey ? 0.14 : 0.5, 1);
  });

  function render(now: number): void {
    if (!ctx || cssWidth === 0) {
      requestAnimationFrame(render);
      return;
    }
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    const top = TOP * cssHeight;
    const bottom = BOTTOM * cssHeight;

    // The frame: a soundbox down the left, a neck across the top. Flat on, so
    // a position on a string is a position on the screen and needs no
    // unprojecting.
    ctx.fillStyle = "#2b1d12";
    ctx.beginPath();
    ctx.moveTo(cssWidth * 0.02, top - 10);
    ctx.quadraticCurveTo(cssWidth * 0.5, top - 26, cssWidth * 0.98, top - 6);
    ctx.lineTo(cssWidth * 0.98, top + 4);
    ctx.quadraticCurveTo(cssWidth * 0.5, top - 14, cssWidth * 0.02, top + 2);
    ctx.closePath();
    ctx.fill();
    // The soundboard, and the reason the bottom of a string is not the top of
    // it: energy leaves here, so a pluck near the board is brighter, louder
    // and shorter. It is drawn solid, and the neck above is drawn thin, so the
    // asymmetry you can hear is one you can see.
    const board = ctx.createLinearGradient(0, bottom - 6, 0, cssHeight);
    board.addColorStop(0, "#6b4a2c");
    board.addColorStop(1, "#2c1d11");
    ctx.fillStyle = board;
    ctx.fillRect(0, bottom - 6, cssWidth, cssHeight - bottom + 6);

    for (const string of STRINGS) {
      const x = string.x * cssWidth;
      const live = ringing.get(string.index);
      const age = live ? (now - live.born) / RING_MS : 1;

      if (live && age < 1) {
        // The string draws what it is doing: the standing wave its own pluck
        // point produces, decaying. Same fact as the harmonic content — shown
        // rather than described.
        const shape = shapeAt(live.position, (now - live.born) / 1000 * 18, 48);
        const swing = 13 * (1 - age) * live.force * (0.5 + string.index / STRINGS.length);
        // Overtone-against-fundamental, the same number the ear is following,
        // mapped straight to colour rather than a guessed range.
        const bright = Math.min(1, overtoneRatio(live.position) / 2.4);
        ctx.strokeStyle = `hsl(${44 - bright * 16} ${45 + bright * 40}% ${68 + bright * 22}%)`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < shape.length; i++) {
          const t = i / (shape.length - 1);
          const py = top + (bottom - top) * t;
          const pxx = x + shape[i] * swing;
          if (i === 0) ctx.moveTo(pxx, py);
          else ctx.lineTo(pxx, py);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#9d8a6d";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      }

      // The nodes, faint. A sound that changes character at a specific place
      // is only playable if the place can be found — this is the only marking
      // on the instrument, and the only hint that position means anything.
      // Warmer nearer the soundboard: the same gradient the sound has.
      for (const node of NODES) {
        ctx.fillStyle = `rgb(255 245 220 / ${(10 + boardProximity(node) * 14).toFixed(0)}%)`;
        const py = top + (bottom - top) * node;
        ctx.beginPath();
        ctx.arc(x, py, node === 0.5 ? 2.2 : 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const [index, live] of ringing) {
      if ((now - live.born) / RING_MS >= 1) ringing.delete(index);
    }

    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
}
