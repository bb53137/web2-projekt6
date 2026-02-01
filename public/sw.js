const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `web2-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `web2-runtime-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/idb.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];


self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});


self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (![APP_SHELL_CACHE, RUNTIME_CACHE].includes(k)) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});


self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match("/index.html");
      }
    })());
    return;
  }

  
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const cache = await caches.open(RUNTIME_CACHE);

      const fetchPromise = fetch(req)
        .then((res) => {
          cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })());
    return;
  }

  
  if (req.destination === "image") {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, res.clone());
      return res;
    })());
    return;
  }
});


self.addEventListener("push", (event) => {
  let data = { title: "WEB2 Projekt 6", body: "Push poruka." };
  try {
    if (event.data) data = JSON.parse(event.data.text());
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});


self.addEventListener("sync", (event) => {
  if (event.tag === "sync-notes") {
    event.waitUntil(syncNotes());
  }
});



const DB_NAME = "web2-projekt6-db";
const DB_VERSION = 1;
const STORE = "notes";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllNotesSW() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function markNotesSyncedSW(ids) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);

    ids.forEach((id) => {
      const g = store.get(id);
      g.onsuccess = () => {
        const item = g.result;
        if (item) {
          item.synced = true;
          store.put(item);
        }
      };
    });

    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function syncNotes() {
  const all = await getAllNotesSW();
  const notes = all.filter((n) => n.synced === false);

  if (!notes.length) return;

  const compact = await Promise.all(
    notes.map(async (n) => {
      const imageBase64 = n.imageBlob ? await blobToBase64(n.imageBlob) : null;
      return { id: n.id, text: n.text, createdAt: n.createdAt, imageBase64 };
    })
  );

  try {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: compact })
    });

    if (res.ok) {
      await markNotesSyncedSW(notes.map((n) => n.id));
    } else {
      
      throw new Error("Server returned non-OK");
    }
  } catch (e) {
    
    throw e;
  }
}

