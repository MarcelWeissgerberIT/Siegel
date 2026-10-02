"use client";

import { Eraser } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { asset } from "@/client/api";
import { cn } from "@/lib/cn";

const INK = "#1c2445";
// Higgsfield-rendered fountain pen (public/media/pen.webp), drawn at PEN_SIZE css px.
// The nib tip sits at NIB inside the image; the pen's axis is PEN_AXIS degrees off horizontal.
const PEN_SIZE = 140;
const NIB = { x: 2, y: 134.6 };
const PEN_AXIS = 44.3;
const PEN_LENGTH = 190;
// Italic nib held at 45°: strokes across the nib edge are broad, strokes along it hairline.
const NIB_EDGE = -Math.PI / 4;
const WET_MS = 900;

type Pt = { x: number; y: number; t: number };
type Wet = { a: Pt; b: Pt; c: Pt; w: number; t: number };
type PenState = "rest" | "hover" | "down";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Fresh ink is glossy and a touch bluer; it dries into the matte ink on the main canvas. Returns the still-wet segments. */
function paintWet(c: HTMLCanvasElement | null, segments: Wet[]) {
  if (!c) return [];
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  const now = performance.now();
  const left = segments.filter((s) => now - s.t < WET_MS);
  for (const s of left) {
    const life = 1 - (now - s.t) / WET_MS;
    const m1 = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    const m2 = { x: (s.b.x + s.c.x) / 2, y: (s.b.y + s.c.y) / 2 };
    g.beginPath();
    g.moveTo(m1.x, m1.y);
    g.quadraticCurveTo(s.b.x, s.b.y, m2.x, m2.y);
    g.strokeStyle = `rgba(52, 78, 190, ${0.55 * life})`;
    g.lineWidth = s.w + 0.6;
    g.stroke();
    g.strokeStyle = `rgba(255, 255, 255, ${0.5 * life})`;
    g.lineWidth = Math.max(0.5, s.w * 0.28);
    g.stroke();
  }
  return left;
}

/**
 * Signature canvas with a fountain pen: the pen rests on the paper, follows the hand while
 * signing, and lays down ink that varies with speed and direction and dries from wet to matte.
 * Emits a trimmed PNG data URL of the ink only (or null when empty).
 */
export function SignaturePad({ onChange, className }: { onChange: (dataUrl: string | null) => void; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wetRef = useRef<HTMLCanvasElement>(null);
  const penRef = useRef<HTMLImageElement>(null);
  const drawing = useRef(false);
  const points = useRef<Pt[]>([]);
  const width = useRef(2.4);
  const wet = useRef<Wet[]>([]);
  const wetFrame = useRef(0);
  const strokes = useRef(0);
  const pen = useRef({ x: 0, y: 0, rot: 0, state: "rest" as PenState, lastX: 0, lastT: 0, restTimer: 0 });
  const [empty, setEmpty] = useState(true);
  const [penShown, setPenShown] = useState(false);

  const sizeCanvas = (c: HTMLCanvasElement | null) => {
    if (!c) return null;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.lineCap = "round";
    g.lineJoin = "round";
    return g;
  };

  const setup = useCallback(() => {
    const g = sizeCanvas(canvasRef.current);
    if (g) g.strokeStyle = INK;
    sizeCanvas(wetRef.current);
  }, []);

  // ------------------------------------------------------------------ pen

  const placePen = useCallback((from: PenState | null) => {
    const el = penRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const p = pen.current;
    let { x, y } = p;
    let rot = p.rot;
    let lift = 0;
    if (p.state === "rest") {
      // Lying on the paper, just above the signature line, nib pointing left.
      x = wrap.clientWidth - PEN_LENGTH - 18;
      y = wrap.clientHeight - 50;
      rot = PEN_AXIS;
    } else if (p.state === "hover") lift = 7;
    // Picking the pen up or putting it down glides; hovering trails the cursor a touch; writing is exact.
    el.style.transition =
      from === null || p.state === "down"
        ? "filter 160ms"
        : from === "rest" || p.state === "rest"
          ? "transform 460ms cubic-bezier(.2,.8,.2,1), filter 300ms"
          : "transform 90ms ease-out, filter 200ms";
    el.style.transform = `translate3d(${x - NIB.x + lift * 0.45}px, ${y - NIB.y - lift}px, 0) rotate(${rot}deg)`;
    el.style.filter =
      p.state === "down"
        ? "drop-shadow(3px 4px 2px rgba(10,12,30,.32))"
        : p.state === "hover"
          ? "drop-shadow(9px 14px 9px rgba(10,12,30,.24))"
          : "drop-shadow(1px 5px 4px rgba(10,12,30,.28))";
  }, []);

  const penTo = (e: React.PointerEvent, state: PenState) => {
    const wrap = wrapRef.current!.getBoundingClientRect();
    const p = pen.current;
    const x = e.clientX - wrap.left;
    const y = e.clientY - wrap.top;
    const from = p.state;
    const wasRest = from === "rest";
    // Tilt a little with the horizontal speed of the hand.
    const dt = Math.max(1, e.timeStamp - p.lastT);
    const vx = wasRest ? 0 : (x - p.lastX) / dt;
    p.rot = p.rot * 0.75 + clamp(vx * 7, -9, 9) * 0.25;
    p.lastX = x;
    p.lastT = e.timeStamp;
    p.x = x;
    p.y = y;
    p.state = state;
    window.clearTimeout(p.restTimer);
    placePen(from);
  };

  const penRest = (delay: number) => {
    const p = pen.current;
    window.clearTimeout(p.restTimer);
    p.restTimer = window.setTimeout(() => {
      const from = p.state;
      p.state = "rest";
      p.rot = 0;
      placePen(from);
    }, delay);
  };

  useEffect(() => {
    setup();
    placePen(null);
    const onResize = () => {
      if (strokes.current === 0) setup();
      if (pen.current.state === "rest") placePen(null);
    };
    window.addEventListener("resize", onResize);
    const p = pen.current;
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(p.restTimer);
      cancelAnimationFrame(wetFrame.current);
    };
  }, [setup, placePen]);

  // ------------------------------------------------------------------ ink

  const startWet = () => {
    if (wetFrame.current) return;
    const tick = () => {
      wet.current = paintWet(wetRef.current, wet.current);
      wetFrame.current = wet.current.length ? requestAnimationFrame(tick) : 0;
    };
    wetFrame.current = requestAnimationFrame(tick);
  };

  const pos = (e: React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  };

  const exportPng = () => {
    const c = canvasRef.current!;
    const g = c.getContext("2d")!;
    const { width: w, height: h } = c;
    const data = g.getImageData(0, 0, w, h).data;
    let x0 = w,
      y0 = h,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 2)
        if (data[(y * w + x) * 4 + 3] > 0) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
    if (x1 <= x0 || y1 <= y0) return null;
    const pad = 12;
    const out = document.createElement("canvas");
    out.width = Math.min(w, x1 - x0 + pad * 2);
    out.height = Math.min(h, y1 - y0 + pad * 2);
    out.getContext("2d")!.drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    penTo(e, "down");
    const p = pos(e);
    points.current = [p];
    width.current = 2.6;
    // A small pool of ink where the nib touches down.
    const g = canvasRef.current!.getContext("2d")!;
    g.beginPath();
    g.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    g.fillStyle = INK;
    g.fill();
  };

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) {
      if (e.pointerType !== "touch") penTo(e, "hover");
      return;
    }
    penTo(e, "down");
    const g = canvasRef.current!.getContext("2d")!;
    const pts = points.current;
    const p = pos(e);
    const prev = pts[pts.length - 1];
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    if (dist < 0.8) return;
    pts.push(p);
    if (pts.length < 3) return;
    const [a, b, c] = pts.slice(-3);
    // Faster strokes run thinner; the italic nib adds thick-thin contrast by direction.
    const speed = dist / Math.max(1, p.t - prev.t);
    const angle = Math.atan2(c.y - b.y, c.x - b.x);
    const target = clamp(3.4 - speed * 1.1, 1.3, 3.4) * (0.55 + 0.45 * Math.abs(Math.sin(angle - NIB_EDGE)));
    width.current = width.current * 0.65 + target * 0.35;
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    g.beginPath();
    g.moveTo(m1.x, m1.y);
    g.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
    g.lineWidth = width.current;
    g.strokeStyle = INK;
    g.stroke();
    wet.current.push({ a, b, c, w: width.current, t: performance.now() });
    startWet();
  };

  const up = (e: React.PointerEvent) => {
    if (drawing.current) {
      drawing.current = false;
      strokes.current++;
      setEmpty(false);
      onChange(exportPng());
    }
    if (e.pointerType === "touch" || e.type === "pointerleave" || e.type === "pointercancel") penRest(e.pointerType === "touch" ? 1200 : 0);
    else penTo(e, "hover");
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    wet.current = [];
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-xl border border-dashed border-line-strong bg-white">
        <canvas
          ref={canvasRef}
          className={cn("block h-40 w-full touch-none", penShown ? "cursor-none" : "cursor-crosshair")}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          aria-label="Draw your signature"
          role="img"
        />
        <canvas ref={wetRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
        <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-[#1c2445]/20" />
        <span className="pointer-events-none absolute bottom-3 left-6 text-[11px] text-[#1c2445]/45">{empty ? "Sign here with your mouse or finger" : "Signature"}</span>
        {!empty && (
          <button type="button" onClick={clear} className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-xs text-[#1c2445]/70 hover:bg-black/10">
            <Eraser className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={penRef}
        src={asset("/media/pen.webp")}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={() => setPenShown(true)}
        width={PEN_SIZE}
        height={PEN_SIZE}
        className={cn("pointer-events-none absolute left-0 top-0 z-10 select-none transition-opacity duration-500", penShown ? "opacity-100" : "opacity-0")}
        style={{ width: PEN_SIZE, height: PEN_SIZE, transformOrigin: `${NIB.x}px ${NIB.y}px` }}
      />
    </div>
  );
}
