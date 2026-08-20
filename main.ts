// The drum you can see and hit. Physics lives in ./membrane (pure), sound in
// ./voice (Web Audio); this file is the head, the input, and nothing else.
import { brightness, type Strike } from "./membrane";
import { createDrum, type Drum } from "./voice";

const mount = document.querySelector<HTMLElement>("#drum");

if (mount) {
  const canvas = document.createElement("canvas");
  canvas.dataset.testid = "drum-head";
  canvas.setAttribute("role", "button");
  canvas.setAttribute("tabindex", "0");
  canvas.setAttribute("aria-label", "Drum head. Click or tap anywhere on it to strike. Keys 1 to 9 strike from the centre outward.");
  mount.append(canvas);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.dataset.testid = "hint";
  hint.textContent = "Hit it anywhere. Keys 1–9 go from the middle out.";
  mount.append(hint);

  // Published for the checks and for me: a strike is otherwise invisible to
  // anything that can't hear, and "did that do something" needs an answer
  // that isn't my ear alone.
  const mirror = document.createElement("div");
  mirror.dataset.testid = "drum-state";
  mirror.hidden = true;
  mirror.dataset.strikes = "0";
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

  const headRadius = () => Math.min(cssWidth, cssHeight) / 2 - 8;
  const centre = () => ({ x: cssWidth / 2, y: cssHeight / 2 });

  // Ripples are the only visual feedback, and they carry information rather
  // than decoration: where you hit, and how bright it was.
  type Ripple = { x: number; y: number; born: number; bright: number; force: number };
  let ripples: Ripple[] = [];
  const RIPPLE_MS = 620;

  let drum: Drum | null = null;
  let strikes = 0;

  // The context starts suspended and only a real gesture may resume it — the
  // autoplay policy, and also just good manners: nothing sounds before the
  // player asks for a sound.
  function ensureAudio(): Drum {
    if (!drum) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      drum = createDrum(new AudioCtor());
    }
    if (drum.context.state === "suspended") void drum.context.resume();
    return drum;
  }

  function strikeAt(x: number, y: number, force = 0.9): void {
    const c = centre();
    const r = Math.min(1, Math.hypot(x - c.x, y - c.y) / headRadius());
    const strike: Strike = { radius: r, force };
    ensureAudio().strike(strike);
    ripples.push({ x, y, born: performance.now(), bright: brightness(strike), force });
    strikes++;
    mirror.dataset.strikes = String(strikes);
    mirror.dataset.lastRadius = r.toFixed(4);
    mirror.dataset.lastBrightness = brightness(strike).toFixed(4);
  }

  function strikeFromEvent(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    strikeAt(clientX - rect.left, clientY - rect.top);
  }

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    canvas.focus();
    strikeFromEvent(e.clientX, e.clientY);
  });

  // Keys 1-9 walk out from the centre. The phone has no keyboard and the
  // desktop has no finger, and neither is allowed to be the only way in.
  canvas.addEventListener("keydown", (e) => {
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 9) return;
    e.preventDefault();
    const c = centre();
    const r = ((n - 1) / 8) * 0.95;
    strikeAt(c.x + r * headRadius(), c.y, 0.9);
  });

  function render(now: number): void {
    if (!ctx || cssWidth === 0) {
      requestAnimationFrame(render);
      return;
    }
    const c = centre();
    const R = headRadius();
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // The head.
    ctx.fillStyle = "#1b1714";
    ctx.beginPath();
    ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#6d5a49";
    ctx.lineWidth = 6;
    ctx.stroke();

    ripples = ripples.filter((rp) => now - rp.born < RIPPLE_MS);
    for (const rp of ripples) {
      // Clamped, because `now` here is requestAnimationFrame's timestamp —
      // the moment the frame *began* — while `born` is performance.now() at
      // the instant of the strike. Same clock, but a strike handled after the
      // frame started is stamped later than the frame it is first drawn in,
      // which made life negative and asked the canvas for an arc of radius
      // -61.29. Only a real browser with a pageerror listener saw it: nothing
      // visibly broke, the throw just killed that one frame.
      const life = Math.min(1, Math.max(0, (now - rp.born) / RIPPLE_MS));
      const radius = 6 + life * R * 0.9 * rp.force;
      // Brighter strikes ring wider and colder; a centre thump stays warm and
      // close. The colour is the brightness number, not a mood.
      const warmth = Math.min(1, Math.max(0, (rp.bright - 1.4) / 0.8));
      const hue = 28 + warmth * 160;
      ctx.strokeStyle = `hsl(${hue} 70% 62% / ${(1 - life) * 0.8})`;
      ctx.lineWidth = 3 * (1 - life) + 0.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    requestAnimationFrame(render);
  }

  resize();
  requestAnimationFrame(render);
}
