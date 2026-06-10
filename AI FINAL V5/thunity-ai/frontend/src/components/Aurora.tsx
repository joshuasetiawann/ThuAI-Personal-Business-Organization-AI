// Aurora — "Silk Loom" ambient: flowing pure-CSS conic silk ribbons (refined
// royal-blue -> indigo -> violet -> soft-magenta; grained) + a cursor-reactive
// <canvas> dot field whose SMALL dots slowly CYCLE COLOUR through the same
// jewel palette by position + time, and light up / ripple under the pointer.
//
// Colour/motion of the ribbons is pure CSS (§17, cached blur); the JS only
// paints the dot canvas. Decoration only: aria-hidden, pointer-events:none.
//
// Pass `global` to mount it ONCE as a fixed, full-viewport layer behind the
// translucent chrome. ROBUSTNESS: the canvas is sized from its OWN rendered box
// (getBoundingClientRect), driven by a ResizeObserver + a live devicePixelRatio
// matchMedia listener + a per-frame stale-guard, so dimensions AND the pointer
// coordinate space are NEVER stale after a resize, zoom, DPR or display change.
// Perf: DPR capped at 2, pauses on hidden tab / when offscreen, idle-throttled,
// batched fills. Under prefers-reduced-motion it paints ONE static (still
// colourful) grid and attaches no pointer/rAF listeners.
import { useEffect, useRef } from "react";

const GRID_STEP = 24;     // spacing between dots (small, even - Stitch-like)
const POINTER_R = 160;    // radius of the "light-up" pool around the cursor
const DPR_CAP = 2;        // never paint above 2x (60fps budget)
const BASE_R = 1.3;      // small dot radius (Stitch-size)
const BASE_A = 0.30;      // base dot alpha (legible over the deeper #010103 base)
const MAX_BOOST_R = 1.6;  // extra radius at the pointer centre (subtle, elegant)
const MAX_BOOST_A = 0.5;  // extra alpha at the pointer centre
const IDLE_MS = 40;       // idle cap (~25fps colour cycle)
const MOVE_MS = 16;       // ~60fps while the cursor is active
const MOVE_HOLD = 1600;   // stay "active" this long after the last pointer move (ms)
const BANDS = 22;         // colour-band quantisation (richer ramp; batched fills)

// brand jewel stops the dots cycle through - refined royal-blue -> bright blue ->
// indigo -> violet -> soft-magenta (premium Stitch sweep; the tropical neon cyan
// has been dropped for full coherence with the cyan-free §17 silk).
const STOPS: number[][] = [
  [79, 139, 255],   // royal blue   #4F8BFF
  [96, 165, 250],   // bright blue
  [124, 142, 255],  // periwinkle
  [99, 102, 241],   // indigo       #6366F1
  [120, 108, 245],  // blue-violet
  [139, 92, 246],   // violet       #8B5CF6
  [170, 96, 232],   // orchid
  [196, 80, 220],   // soft magenta
  [212, 110, 196],  // soft rose (warm tail, still pink not red)
];
function cyc(phase: number): number[] {
  const n = STOPS.length;
  const p = (((phase % 1) + 1) % 1) * n;
  const i = Math.floor(p) % n;
  const f = p - Math.floor(p);
  const a = STOPS[i], b = STOPS[(i + 1) % n];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}
const BAND_RGB: number[][] = Array.from({ length: BANDS }, (_, k) => cyc(k / BANDS));
function smoothstep(f: number): number { return f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f); }

export default function Aurora({ global = false }: { global?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // live geometry (re-derived from the canvas's OWN box, never the window)
    let dpr = 1;                       // re-read on every applySize() (zoom/display safe)
    let w = 0, h = 0;                  // CSS px size of the canvas box
    let rectLeft = 0, rectTop = 0;     // canvas origin in client space (for pointer mapping)
    let cw = -1, ch = -1;              // last clientWidth/clientHeight seen (stale-guard)
    let step = GRID_STEP, radius = POINTER_R;

    let raf = 0, running = false, last = 0;
    let onScreen = true, sizeQueued = false;

    // pointer state - EXACT, no smoothing
    let px = -9999, py = -9999, sx = -9999, sy = -9999;
    let hasPointer = false, lastMove = -1e9, lastPx = -9999, lastPy = -9999;

    const ripples: { x: number; y: number; t0: number }[] = [];
    let gxs: number[] = [], gys: number[] = [];
    const buckets: number[][] = Array.from({ length: BANDS }, () => []);

    const buildGrid = () => {
      gxs = []; gys = [];
      for (let gx = step / 2; gx < w; gx += step) gxs.push(gx);
      for (let gy = step / 2; gy < h; gy += step) gys.push(gy);
    };

    const bandOf = (gx: number, gy: number, tDrift: number): number => {
      let phase = (gx / w) * 1.8 + (gy / h) * 0.85 + tDrift;
      phase = phase - Math.floor(phase);
      const band = (phase * BANDS) | 0;
      return band >= BANDS ? BANDS - 1 : band;
    };

    const draw = (now: number) => {
      const tDrift = reduce ? 0 : now * 0.0004; // colour drift over time (~4x faster cycle)
      const active = !reduce && (
        (hasPointer && now - lastMove < MOVE_HOLD) ||
        ripples.length > 0
      );
      ctx.clearRect(0, 0, w, h);

      // 1) coloured base grid - bucket dots by colour band, one batched fill each
      for (let k = 0; k < BANDS; k++) buckets[k].length = 0;
      for (let xi = 0; xi < gxs.length; xi++) {
        const gx = gxs[xi];
        for (let yi = 0; yi < gys.length; yi++) {
          const gy = gys[yi];
          // dots inside the pointer pool are painted (boosted) in pass 2
          if (active && hasPointer && Math.abs(gx - sx) < radius && Math.abs(gy - sy) < radius) continue;
          buckets[bandOf(gx, gy, tDrift)].push(gx, gy);
        }
      }
      for (let k = 0; k < BANDS; k++) {
        const arr = buckets[k];
        if (!arr.length) continue;
        const c = BAND_RGB[k];
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${BASE_A})`;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 2) { ctx.moveTo(arr[i] + BASE_R, arr[i + 1]); ctx.arc(arr[i], arr[i + 1], BASE_R, 0, 6.2832); }
        ctx.fill();
      }

      // 2) boosted dots inside the pointer pool (scale + brighten toward white) + ripples
      if (active && hasPointer) {
        const x1 = Math.min(w, sx + radius), y1 = Math.min(h, sy + radius);
        const sX = Math.ceil((Math.max(0, sx - radius) - step / 2) / step) * step + step / 2;
        const sY = Math.ceil((Math.max(0, sy - radius) - step / 2) / step) * step + step / 2;
        for (let gx = sX; gx < x1; gx += step)
          for (let gy = sY; gy < y1; gy += step) {
            const d = Math.hypot(gx - sx, gy - sy);
            let f = smoothstep(1 - d / radius);
            for (const rp of ripples) {
              const age = (now - rp.t0) / 700;
              if (age > 1) continue;
              const ring = age * 240;
              const dd = Math.abs(Math.hypot(gx - rp.x, gy - rp.y) - ring);
              if (dd < 26) f = Math.min(1, f + (1 - dd / 26) * (1 - age) * 0.6);
            }
            const c = BAND_RGB[bandOf(gx, gy, tDrift)];
            if (f <= 0.02) {
              ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${BASE_A})`;
              ctx.beginPath(); ctx.arc(gx, gy, BASE_R, 0, 6.2832); ctx.fill();
              continue;
            }
            const r = Math.round(c[0] + (255 - c[0]) * f * 0.45);
            const g = Math.round(c[1] + (255 - c[1]) * f * 0.45);
            const b = Math.round(c[2] + (255 - c[2]) * f * 0.45);
            ctx.fillStyle = `rgba(${r},${g},${b},${(BASE_A + f * MAX_BOOST_A).toFixed(3)})`;
            ctx.beginPath(); ctx.arc(gx, gy, BASE_R + f * MAX_BOOST_R, 0, 6.2832); ctx.fill();
          }
      }

      for (let i = ripples.length - 1; i >= 0; i--)
        if ((now - ripples[i].t0) / 700 > 1) ripples.splice(i, 1);
    };

    // SIZE from the canvas's real rendered box - correct for the global fixed
    // mount AND the Login mount, and immune to window vs element mismatches.
    // Re-reads devicePixelRatio every call so zoom / display changes are honoured.
    const applySize = () => {
      const r = canvas.getBoundingClientRect();
      const newW = Math.max(1, Math.round(r.width));
      const newH = Math.max(1, Math.round(r.height));
      const newDpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

      rectLeft = r.left; rectTop = r.top;
      cw = canvas.clientWidth; ch = canvas.clientHeight;

      if (newW === w && newH === h && newDpr === dpr) {
        draw(performance.now());        // box unchanged (e.g. scroll) -> just repaint
        return;
      }
      w = newW; h = newH; dpr = newDpr;
      step = w < 768 ? 22 : GRID_STEP;
      radius = w < 768 ? 120 : POINTER_R;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // draw in CSS px; backing store is DPR-scaled
      buildGrid();
      draw(performance.now());          // immediate repaint (also covers reduced-motion)
    };

    // rAF-coalesced resize: many events in one frame -> one applySize.
    const queueSize = () => {
      if (sizeQueued) return;
      sizeQueued = true;
      requestAnimationFrame(() => { sizeQueued = false; applySize(); });
    };

    const tick = (now: number) => {
      raf = 0;
      if (!running) return;

      // PER-FRAME STALE GUARD - self-heal if any observer missed an event so the
      // canvas dims AND pointer coordinate space are NEVER stale (zoom/DPR/layout).
      if (canvas.clientWidth !== cw || canvas.clientHeight !== ch ||
          Math.min(window.devicePixelRatio || 1, DPR_CAP) !== dpr) {
        applySize();
      }

      if (hasPointer) { sx = px; sy = py; }   // track the cursor EXACTLY - no trailing/offset
      const gate = (hasPointer && now - lastMove < MOVE_HOLD) ? MOVE_MS : IDLE_MS;
      if (now - last >= gate) { last = now; draw(now); }
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (running || reduce || document.hidden || !onScreen) return; running = true; last = 0; raf = requestAnimationFrame(tick); };
    const stop = () => { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    // pointer mapped through the canvas rect -> identical to draw space at any
    // size/zoom/scroll (the offset bug cannot occur).
    const onMove = (e: PointerEvent) => {
      px = e.clientX - rectLeft; py = e.clientY - rectTop;
      if (sx < -1000) { sx = px; sy = py; }
      const sp = Math.hypot(px - lastPx, py - lastPy);
      if (lastPx > -1000 && sp > 70 && ripples.length < 3) ripples.push({ x: px, y: py, t0: performance.now() });
      lastPx = px; lastPy = py; hasPointer = true; lastMove = performance.now();
      start();
    };
    const onDown = (e: PointerEvent) => {
      const dx = e.clientX - rectLeft, dy = e.clientY - rectTop;
      if (ripples.length < 4) ripples.push({ x: dx, y: dy, t0: performance.now() });
      px = dx; py = dy; hasPointer = true; lastMove = performance.now(); start();
    };
    const onLeave = () => { hasPointer = false; };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    const onScroll = () => { const r = canvas.getBoundingClientRect(); rectLeft = r.left; rectTop = r.top; };

    // LIVE devicePixelRatio: a self-re-arming matchMedia(resolution) listener
    // fires the instant zoom / monitor DPR changes (no polling).
    let dprMql: MediaQueryList | null = null;
    const onDprChange = () => { queueSize(); watchDpr(); };
    const watchDpr = () => {
      if (dprMql) dprMql.removeEventListener("change", onDprChange);
      dprMql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMql.addEventListener("change", onDprChange);
    };

    // observers: element box + viewport, all funnelled into queueSize()
    const ro = new ResizeObserver(() => queueSize());
    ro.observe(canvas);
    if (document.documentElement) ro.observe(document.documentElement);

    const io = new IntersectionObserver((ents) => {
      onScreen = ents.some((e) => e.isIntersecting);
      if (onScreen) start(); else stop();
    });
    io.observe(canvas);

    // initial sizing/paint
    applySize();
    watchDpr();

    window.addEventListener("resize", queueSize, { passive: true });
    window.addEventListener("orientationchange", queueSize, { passive: true });
    window.visualViewport?.addEventListener("resize", queueSize, { passive: true });

    if (reduce) {
      // motionless, still-colourful grid; observers keep it crisp on resize,
      // but NO pointer / rAF / visibility listeners.
      draw(0);
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerleave", onLeave, { passive: true });
      window.addEventListener("blur", onLeave, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      document.addEventListener("visibilitychange", onVis);
      start();
    }

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      if (dprMql) dprMql.removeEventListener("change", onDprChange);
      window.removeEventListener("resize", queueSize);
      window.removeEventListener("orientationchange", queueSize);
      window.visualViewport?.removeEventListener("resize", queueSize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      window.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className={"aurora" + (global ? " aurora--global" : "")} aria-hidden="true">
      <span className="aurora-base" />
      <span className="aurora-silk aurora-silk--blue" />
      <span className="aurora-silk aurora-silk--violet" />
      <span className="aurora-silk aurora-silk--teal" />
      <span className="aurora-glow" />
      <span className="aurora-grain" />
      <canvas ref={canvasRef} className="aurora-dots" />
    </div>
  );
}
