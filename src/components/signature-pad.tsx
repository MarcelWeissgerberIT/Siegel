"use client";

import { Eraser } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Smooth, pressure-free signature canvas. Emits a trimmed PNG data URL (or null when empty). */
export function SignaturePad({ onChange, className }: { onChange: (dataUrl: string | null) => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "#1c2445";
    g.lineWidth = 2.4;
  }, []);

  useEffect(() => {
    setup();
    const onResize = () => {
      if (strokes.current === 0) setup();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
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
    points.current = [pos(e)];
    const g = canvasRef.current!.getContext("2d")!;
    const p = points.current[0];
    g.beginPath();
    g.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
    g.fillStyle = "#1c2445";
    g.fill();
  };

  const moveTo = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const g = canvasRef.current!.getContext("2d")!;
    const pts = points.current;
    pts.push(pos(e));
    if (pts.length < 3) return;
    const [a, b, c] = pts.slice(-3);
    const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    g.beginPath();
    g.moveTo(m1.x, m1.y);
    g.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
    g.stroke();
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    strokes.current++;
    setEmpty(false);
    onChange(exportPng());
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-line-strong bg-white", className)}>
      <canvas
        ref={canvasRef}
        className="block h-40 w-full cursor-crosshair touch-none"
        onPointerDown={down}
        onPointerMove={moveTo}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        aria-label="Draw your signature"
        role="img"
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-[#1c2445]/20" />
      <span className="pointer-events-none absolute bottom-3 left-6 text-[11px] text-[#1c2445]/45">{empty ? "Sign here with your mouse or finger" : "Signature"}</span>
      {!empty && (
        <button type="button" onClick={clear} className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/5 px-2 py-1 text-xs text-[#1c2445]/70 hover:bg-black/10">
          <Eraser className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
