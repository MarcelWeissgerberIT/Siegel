"use client";

import { useEffect, useRef } from "react";
import { asset } from "@/client/api";
import { cn } from "@/lib/cn";

/** Ambient Higgsfield motion loop: muted, inline, paused when off-screen or with reduced motion. */
export function LoopVideo({
  name,
  className,
  loop = true,
  autoPlay = true,
  onEnded,
  rate = 1,
}: {
  name: string;
  className?: string;
  loop?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
  rate?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!v || reduced || !autoPlay) return;
    v.playbackRate = rate;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [autoPlay, rate]);
  return (
    <video
      ref={ref}
      className={cn("object-cover", className)}
      src={asset(`/media/${name}.mp4`)}
      poster={asset(`/media/${name}-poster.jpg`)}
      muted
      playsInline
      loop={loop}
      preload="metadata"
      onEnded={onEnded}
      aria-hidden
    />
  );
}

/** Plays a Higgsfield clip once when it scrolls into view, then holds the last frame. */
export function RevealVideo({ name, className }: { name: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const toEnd = () => (v.currentTime = Math.max(0, v.duration - 0.05));
      v.addEventListener("loadedmetadata", toEnd, { once: true });
      return () => v.removeEventListener("loadedmetadata", toEnd);
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        v.play().catch(() => {});
        io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      className={cn("object-cover", className)}
      src={asset(`/media/${name}.mp4`)}
      poster={asset(`/media/${name}-poster.jpg`)}
      muted
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}

export function Img({ name, alt = "", className }: { name: string; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset(`/media/${name}.webp`)} alt={alt} className={cn("object-cover", className)} loading="lazy" decoding="async" />;
}

export const COVERS = {
  ember: { label: "Ember", image: "cover-ember", video: "silk-loop" },
  ink: { label: "Ink", image: "cover-ink", video: null },
  dawn: { label: "Dawn", image: "cover-dawn", video: null },
  emerald: { label: "Emerald", image: "cover-emerald", video: null },
} as const;
