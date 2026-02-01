import express from "express";
import webpush from "web-push";

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));


const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "REPLACE_ME_PUBLIC";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "REPLACE_ME_PRIVATE";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:test@example.com";

if (VAPID_PUBLIC_KEY.startsWith("REPLACE_ME") || VAPID_PRIVATE_KEY.startsWith("REPLACE_ME")) {
  console.log("⚠️  Nema VAPID ključeva. Push će raditi tek kad postaviš VAPID ključeve.");
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}


const subscriptions = new Set();

app.get("/api/vapidPublicKey", (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});


app.post("/api/subscribe", (req, res) => {
  try {
    const sub = req.body;
    if (!sub || !sub.endpoint) return res.status(400).json({ error: "Bad subscription" });
    subscriptions.add(JSON.stringify(sub));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Subscribe failed" });
  }
});


app.post("/api/notes", async (req, res) => {
  try {
    const { notes } = req.body || {};
    if (!Array.isArray(notes)) return res.status(400).json({ error: "notes must be array" });

    //samo loganje
    console.log(" Received notes:", notes.map(n => n.id));

    //nakon synca pošalje sepush (ako ima VAPID i subscriptione)
    const canPush = !VAPID_PUBLIC_KEY.startsWith("REPLACE_ME") && !VAPID_PRIVATE_KEY.startsWith("REPLACE_ME");
    if (canPush && subscriptions.size > 0) {
      const payload = JSON.stringify({
        title: "WEB2 Projekt 6",
        body: `Sinkronizirano ${notes.length} bilješki `
      });

      //pošalji svima, obriši nevažeće
      const toDelete = [];
      await Promise.all(
        Array.from(subscriptions).map(async (subStr) => {
          const sub = JSON.parse(subStr);
          try {
            await webpush.sendNotification(sub, payload);
          } catch (e) {
            //ako subscription više ne vrijedi (npr. 410), ukloni
            if (e?.statusCode === 404 || e?.statusCode === 410) {
              toDelete.push(subStr);
            }
          }
        })
      );
      toDelete.forEach(s => subscriptions.delete(s));
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Sync failed" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
