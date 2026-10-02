import { cn } from "@/lib/cn";

function scallopPath(cx: number, cy: number, r: number, bumps = 14, amp = 0.08) {
  const pts: string[] = [];
  const steps = 112;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r * (1 + amp * Math.cos(bumps * a));
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const SEAL = scallopPath(12, 12, 10.6);

export function SealMark({ className, color = "var(--accent)", ticks = false }: { className?: string; color?: string; ticks?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={SEAL} fill={color} />
      <circle cx="12" cy="12" r="8.1" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth=".6" />
      {ticks &&
        Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={12 + Math.cos(a) * 8.6}
              y1={12 + Math.sin(a) * 8.6}
              x2={12 + Math.cos(a) * 9.3}
              y2={12 + Math.sin(a) * 9.3}
              stroke="#fff"
              strokeOpacity=".45"
              strokeWidth=".35"
            />
          );
        })}
      <path
        d="M15.3 9.2c-.7-1.1-1.9-1.7-3.4-1.7-1.9 0-3.2 1-3.2 2.4 0 3.4 6.8 1.9 6.8 5.5 0 1.5-1.5 2.6-3.6 2.6-1.6 0-2.9-.6-3.7-1.8"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const t = size === "lg" ? "text-[26px]" : size === "sm" ? "text-[17px]" : "text-[21px]";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SealMark className={cn(s, "drop-shadow-[0_2px_6px_rgba(214,60,34,0.35)]")} />
      <span className={cn("font-serif leading-none tracking-tight text-fg", t)}>Siegel</span>
    </span>
  );
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
