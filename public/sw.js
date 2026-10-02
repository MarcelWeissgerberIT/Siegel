/* Siegel service worker: installable PWA with offline support.
 * - App pages: network-first, falling back to the cached copy (the static
 *   demo keeps all data in IndexedDB, so it works fully offline once cached).
 * - Hashed build assets, fonts, icons, images: cache-first.
 * - Never touches /api/* (auth, RPC, Stripe webhooks) or non-GET requests.
 */
const VERSION = "siegel-v2";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const SCOPE = new URL(self.registration.scope).pathname; // e.g. "/Siegel/" or "/"
// Stills used across the app (≈2 MB) so covers and empty states also render offline.
const MEDIA = [
  "media/cover-ember.webp", "media/cover-ink.webp", "media/cover-dawn.webp", "media/cover-emerald.webp",
  "media/cover-ember-thumb.webp", "media/cover-ink-thumb.webp", "media/cover-dawn-thumb.webp", "media/cover-emerald-thumb.webp",
  "media/hero-seal.webp", "media/wax-disc.webp", "media/certificate.webp",
  "media/hero-loop-poster.jpg", "media/chain-loop-poster.jpg", "media/chain-break-poster.jpg", "media/seal-press-poster.jpg",
  "media/notes-flow-poster.jpg", "media/silk-loop-poster.jpg", "media/wax-drop-poster.jpg",
  "media/pen.webp", "media/pen-reveal-poster.jpg",
];
const ROUTES = ["", "dashboard/", "new/", "proposal/", "templates/", "settings/", "verify/", "p/", "p/pay/", "login/"];

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const found = new Set();
  await Promise.all(
    ROUTES.map(async (r) => {
      try {
        const res = await fetch(SCOPE + r, { cache: "no-cache" });
        if (!res.ok) return;
        const html = await res.clone().text();
        await shell.put(SCOPE + r, res);
        for (const m of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) found.add(m[1]);
      } catch {
        /* offline during install: cached lazily later */
      }
    }),
  );
  await Promise.all(
    [...found, ...MEDIA.map((m) => SCOPE + m), SCOPE + "manifest.webmanifest", SCOPE + "favicon.svg", SCOPE + "icons/icon-192.png"].map((u) =>
      assets.add(u).catch(() => undefined),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith(SCOPE + "api/") || url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isApi(url)) return;
  if (req.headers.has("range") || url.pathname.endsWith(".mp4")) return; // let the browser stream video

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const key = url.origin + url.pathname; // ignore ?id= / ?t= so one cached page serves every record
        try {
          const res = await fetch(req);
          if (res.ok && res.type === "basic") (await caches.open(SHELL)).put(key, res.clone());
          return res;
        } catch {
          return (
            (await caches.match(key)) ||
            (await caches.match(url.origin + SCOPE + "dashboard/")) ||
            new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          );
        }
      })(),
    );
    return;
  }

  const cacheable = url.pathname.includes("/_next/static/") || /\.(?:woff2?|ttf|png|jpe?g|webp|svg|ico|webmanifest)$/.test(url.pathname);
  if (!cacheable) return;
  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === "basic") (await caches.open(ASSETS)).put(req, res.clone());
      return res;
    })(),
  );
});
