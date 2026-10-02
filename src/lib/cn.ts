import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our design tokens so `text-muted` is a color (not a size)
// and later utilities like `px-0` reliably override component defaults.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "bg", "elev", "sunken", "hover", "line", "line-strong", "fg", "muted", "subtle", "accent", "accent-hover", "accent-fg",
        "accent-soft", "gold", "ok", "ok-soft", "warn", "warn-soft", "info", "info-soft", "violet", "violet-soft", "danger", "danger-soft",
      ],
    },
  },
});

export function cn(...parts: (string | false | null | undefined)[]) {
  return twMerge(parts.filter(Boolean).join(" "));
}
