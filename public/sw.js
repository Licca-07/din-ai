const VERSION = "din-ai-v3";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-512-maskable.png",
  "/icons/apple-touch-icon.png",
];

/** @type {ReturnType<typeof setTimeout> | null} */
let pomodoroTimeoutId = null;

function shouldBypass(request) {
  const url = new URL(request.url);

  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;

  if (request.headers.get("RSC") === "1") return true;
  if (request.headers.get("Next-Router-Prefetch") === "1") return true;
  if (request.headers.get("Next-Router-State-Tree")) return true;
  if (request.headers.get("accept")?.includes("text/x-component")) return true;
  if (url.pathname.startsWith("/_next/data")) return true;
  if (url.pathname.startsWith("/_next/webpack-hmr")) return true;

  return false;
}

async function cacheStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);

    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function clearPomodoroSchedule() {
  if (pomodoroTimeoutId !== null) {
    clearTimeout(pomodoroTimeoutId);
    pomodoroTimeoutId = null;
  }
}

function schedulePomodoroNotification(data) {
  clearPomodoroSchedule();

  const { endsAt, title, body, tag } = data;
  const delay = endsAt - Date.now();

  if (delay <= 0) {
    void self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: tag ?? "din-pomodoro",
      renotify: true,
      data: { url: "/" },
    });
    return;
  }

  pomodoroTimeoutId = setTimeout(() => {
    pomodoroTimeoutId = null;
    void self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: tag ?? "din-pomodoro",
      renotify: true,
      data: { url: "/" },
    });
  }, delay);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("din-ai-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;

  if (!data || typeof data !== "object") return;

  if (data.type === "POMODORO_SCHEDULE") {
    schedulePomodoroNotification(data);
    return;
  }

  if (data.type === "POMODORO_CANCEL") {
    clearPomodoroSchedule();
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Din AI",
    body: "",
    url: "/",
    tag: "din-pomodoro",
  };

  try {
    payload = { ...payload, ...(event.data?.json() ?? {}) };
  } catch {
    payload.body = event.data?.text() ?? "";
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag ?? "din-pomodoro",
      renotify: true,
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if ("focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }

        return undefined;
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (shouldBypass(request)) return;

  const url = new URL(request.url);

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheStaticAsset(request));
    return;
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === OFFLINE_URL
  ) {
    event.respondWith(cacheStaticAsset(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
  }
});
