"use client";

import { FileStack, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { auth, MODE } from "@/client/api";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { Kbd, Spinner } from "./ui";

const NAV = [
  { href: "/dashboard/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/templates/", label: "Templates & pricing", icon: FileStack },
  { href: "/settings/", label: "Settings", icon: Settings },
  { href: "/verify/", label: "Verify a certificate", icon: ShieldCheck },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      <Link
        href="/new/"
        onClick={onNavigate}
        className="mb-3 flex h-9 items-center justify-between rounded-[10px] bg-accent px-3 text-sm font-medium text-accent-fg shadow-[0_6px_18px_-6px_var(--ring)] transition hover:bg-accent-hover"
      >
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> New proposal
        </span>
        <span className="rounded bg-white/20 px-1.5 font-mono text-[10px]">N</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path?.startsWith(href.replace(/\/$/, ""));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-[10px] px-3 text-sm transition",
              active ? "bg-hover font-medium text-fg" : "text-muted hover:bg-hover hover:text-fg",
            )}
          >
            <Icon className={cn("h-4 w-4", active ? "text-accent" : "")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer() {
  const router = useRouter();
  return (
    <div className="space-y-3">
      {MODE === "local" ? (
        <div className="rounded-xl border border-line bg-sunken p-3 text-xs leading-relaxed text-muted">
          <p className="font-medium text-fg">Live demo · runs in your browser</p>
          <p className="mt-1">Data is stored locally (IndexedDB). Self-host with Docker to share links with real clients.</p>
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <ThemeToggle />
        {MODE === "server" && (
          <button
            onClick={async () => {
              await auth.action("logout");
              router.replace("/login/");
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(MODE === "local");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (MODE === "local") return;
    auth.session().then((s) => {
      if (!s.authenticated) router.replace(s.needsSetup ? "/login/?setup=1" : "/login/");
      else setReady(true);
    });
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push("/new/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!ready)
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner />
      </div>
    );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-line bg-sunken/60 px-4 py-5 backdrop-blur lg:flex">
        <div>
          <Link href="/dashboard/" className="mb-7 flex items-center px-2">
            <Logo />
          </Link>
          <NavLinks />
        </div>
        <Footer />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/80 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard/">
          <Logo size="sm" />
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-hover" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in flex-col justify-between bg-bg px-4 py-5 shadow-float">
            <div>
              <div className="mb-6 flex items-center justify-between px-2">
                <Logo />
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-hover" aria-label="Close menu">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <Footer />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-subtle">{eyebrow}</div>}
        <h1 className="truncate text-[26px] font-semibold tracking-tight sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { Kbd };
