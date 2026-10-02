"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { BASE_PATH } from "@/client/api";
import { cn } from "@/lib/cn";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker (production only) and captures the install prompt. */
export function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferred = e as InstallPromptEvent;
      listeners.forEach((l) => l());
    };
    const onInstalled = () => {
      deferred = null;
      listeners.forEach((l) => l());
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

/** "Install app" button, shown only when the browser offers installation. */
export function InstallButton({ className, label = "Install app" }: { className?: string; label?: string }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const update = () => setAvailable(!!deferred);
    listeners.add(update);
    const t = setTimeout(update, 0);
    return () => {
      listeners.delete(update);
      clearTimeout(t);
    };
  }, []);
  if (!available) return null;
  return (
    <button
      onClick={async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice.catch(() => undefined);
        deferred = null;
        listeners.forEach((l) => l());
      }}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition", className)}
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
