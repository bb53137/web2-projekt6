import { addNote, getAllNotes, getUnsyncedNotes, markNotesSynced } from "./idb.js";

const els = {
  btnStartCam: document.getElementById("btnStartCam"),
  btnSnap: document.getElementById("btnSnap"),
  btnSave: document.getElementById("btnSave"),
  btnSync: document.getElementById("btnSync"),
  btnEnablePush: document.getElementById("btnEnablePush"),
  status: document.getElementById("status"),
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  preview: document.getElementById("preview"),
  fileInput: document.getElementById("fileInput"),
  noteText: document.getElementById("noteText"),
  notesList: document.getElementById("notesList")
};

let stream = null;
let currentImageBlob = null;
let swReg = null;

function setStatus(msg) {
  els.status.textContent = `Status: ${msg}`;
}

function supportsCamera() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function isLocalhost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

function updateButtons(unsyncedCount) {
  const online = navigator.onLine;

  //sync - samo online, ima nesyncanih
  els.btnSync.disabled = !(online && unsyncedCount > 0);

  //push - na localhost ugašen (push treba HTTPS)
  if (isLocalhost()) {
    els.btnEnablePush.disabled = true;
    els.btnEnablePush.title = "Push radi tek na HTTPS (Render).";
  } else {
    //na renderu omogućen kad dodamo pravi push flow
    els.btnEnablePush.disabled = false;
    els.btnEnablePush.title = "";
  }
}

//service eorker registracija
async function initSW() {
  if (!("serviceWorker" in navigator)) {
    setStatus("Service Worker nije podržan.");
    return;
  }
  swReg = await navigator.serviceWorker.register("/sw.js");
  setStatus("Service Worker aktivan.");
}

//kamera (native API)
async function startCamera() {
  if (!supportsCamera()) {
    setStatus("Kamera nije podržana - koristi fallback odabir slike.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    els.video.srcObject = stream;
    els.btnSnap.disabled = false;
    setStatus("Kamera uključena.");
  } catch {
    setStatus("Nema dozvole za kameru - koristi fallback odabir slike.");
  }
}

function snapPhoto() {
  if (!stream) return;

  const video = els.video;
  const canvas = els.canvas;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  canvas.toBlob((blob) => {
    currentImageBlob = blob;
    els.preview.src = URL.createObjectURL(blob);
    els.preview.style.display = "block";
    els.btnSave.disabled = false;
    setStatus("Fotka spremna.");
  }, "image/jpeg", 0.85);
}

//fallback - odabir slike
function handleFilePick(file) {
  if (!file) return;
  currentImageBlob = file;
  els.preview.src = URL.createObjectURL(file);
  els.preview.style.display = "block";
  els.btnSave.disabled = false;
  setStatus("Slika odabrana (fallback).");
}

//spremi bilješku u IndexedDB (offline)
async function saveLocal() {
  const text = els.noteText.value.trim();
  if (!text) {
    setStatus("Upiši bilješku.");
    return;
  }

  const note = {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    imageBlob: currentImageBlob || null,
    synced: false
  };

  await addNote(note);

  //očisti formu
  els.noteText.value = "";
  currentImageBlob = null;
  els.preview.removeAttribute("src");
  els.preview.style.display = "none";
  els.btnSave.disabled = true;

  //pokušaj automat background sync
  if (swReg && "sync" in swReg) {
    try {
      await swReg.sync.register("sync-notes");
      setStatus("Spremljeno. Auto sync će se izvršiti kad bude online ");
    } catch {
      setStatus("Spremljeno. Auto sync nije uspio, koristi Sync odmah.");
    }
  } else {
    setStatus("Spremljeno. BG sync nije podržan,  koristi Sync odmah.");
  }

  await renderNotes();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

//ručni sync (fallback)
async function manualSync() {
  if (!navigator.onLine) {
    setStatus("Offline si. Sync će se izvršiti kad se vrati internet.");
    return;
  }

  const notes = await getUnsyncedNotes();
  if (!notes.length) {
    setStatus("Nema nesinkroniziranih bilješki.");
    await renderNotes();
    return;
  }

  setStatus("Sinkroniziram...");

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
      await markNotesSynced(notes.map((n) => n.id));
      setStatus(`Sinkronizirano ${notes.length} bilješki `);
      await renderNotes();
    } else {
      setStatus("Sync nije uspio (server error).");
    }
  } catch {
    //nema crvenih errora u konzoli
    setStatus("Sync nije uspio (mreža).");
  }
}

//prikaz bilješki
async function renderNotes() {
  const notes = await getAllNotes();
  els.notesList.innerHTML = "";

  for (const n of notes) {
    const li = document.createElement("li");
    li.className = "note";

    const badge = document.createElement("span");
    badge.className = "badge " + (n.synced ? "ok" : "");
    badge.textContent = n.synced ? "synced" : "offline";

    const text = document.createElement("div");
    text.textContent = n.text;

    li.appendChild(badge);
    li.appendChild(text);

    if (n.imageBlob) {
      const img = document.createElement("img");
      img.alt = "fotka";
      img.src = URL.createObjectURL(n.imageBlob);
      li.appendChild(img);
    }

    const meta = document.createElement("div");
    meta.className = "muted";
    meta.textContent = new Date(n.createdAt).toLocaleString();
    li.appendChild(meta);

    els.notesList.appendChild(li);
  }

  const uns = await getUnsyncedNotes();
  updateButtons(uns.length);
}

//push (tek na Renderu)
async function enablePush() {
  setStatus("Push će se završiti na Renderu (HTTPS i VAPID).");
}

// Init
async function init() {
  await initSW();

  if (!supportsCamera()) {
    setStatus("Kamera nije podržana, koristi fallback odabir slike.");
  }

  await renderNotes();

  //online povremeno osvježiti badgeove (da synced dođe bez refresha)
  setInterval(async () => {
    if (navigator.onLine) await renderNotes();
  }, 4000);
}

els.btnStartCam.addEventListener("click", startCamera);
els.btnSnap.addEventListener("click", snapPhoto);
els.btnSave.addEventListener("click", saveLocal);
els.btnEnablePush.addEventListener("click", enablePush);
els.fileInput.addEventListener("change", (e) => handleFilePick(e.target.files[0]));
els.btnSync.addEventListener("click", manualSync);

window.addEventListener("online", async () => {
  setStatus("Online ");
  await renderNotes();
});

window.addEventListener("offline", async () => {
  setStatus("Offline ");
  await renderNotes();
});

init();
