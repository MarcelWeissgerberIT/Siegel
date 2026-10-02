"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Pref = "system" | "light" | "dark";

function apply(pref: Pref) {
  const t = pref === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
  document.documentElement.dataset.theme = t;
}

function readPref(): Pref {
  try {
    return (localStorage.getItem("siegel:theme") as Pref) || "system";
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("siegel:theme", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("siegel:theme", cb);
    window.removeEventListener("storage", cb);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as Pref);
  const set = (p: Pref) => {
    try {
      localStorage.setItem("siegel:theme", p);
    } catch {}
    apply(p);
    window.dispatchEvent(new Event("siegel:theme"));
  };
  const items: { v: Pref; icon: typeof Sun; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "dark", icon: Moon, label: "Dark" },
    { v: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className={cn("inline-flex rounded-lg border border-line bg-sunken p-0.5", className)}>
      {items.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          onClick={() => set(v)}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          className={cn("grid h-6 w-7 place-items-center rounded-md transition", pref === v ? "bg-elev text-fg shadow-[var(--shadow-sm)]" : "text-subtle hover:text-fg")}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
