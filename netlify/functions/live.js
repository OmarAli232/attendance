import { getStore } from "@netlify/blobs";

const LIVE_ONLINE_MS = 40 * 1000; // أونلاين لو اتحدّث خلال آخر 40 ثانية

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// GET  /api/live  → قراءة المواقع المباشرة (بكلمة السر)
// POST /api/live  → تحديث موقع مباشر من الموظف
export default async (req) => {
  const store = getStore("live");

  if (req.method === "GET") {
    const pass = req.headers.get("x-admin-pass") || "";
    if (pass !== (process.env.ADMIN_PASSCODE || "غيّر_دي_1234")) {
      return json({ error: "غير مصرّح" }, 401);
    }
    const obj = (await store.get("all", { type: "json" })) || {};
    const now = Date.now();
    const list = Object.values(obj).map((r) => ({
      ...r,
      online: now - new Date(r.updatedAt).getTime() <= LIVE_ONLINE_MS
    }));
    list.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return json({ live: list });
  }

  // POST — تحديث الموقع
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const nm = String(body.name || "").trim().slice(0, 80);
  const la = Number(body.lat);
  const ln = Number(body.lng);
  if (!nm || !isFinite(la) || !isFinite(ln)) {
    return json({ error: "بيانات ناقصة" }, 400);
  }
  const obj = (await store.get("all", { type: "json" })) || {};
  obj[nm] = {
    name: nm,
    lat: la,
    lng: ln,
    accuracy: Math.round(Number(body.accuracy) || 0),
    updatedAt: new Date().toISOString()
  };
  await store.setJSON("all", obj);
  return json({ ok: true });
};
