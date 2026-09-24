import { getStore } from "@netlify/blobs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// POST /api/live/stop — الموظف قفل الصفحة أو ضغط إيقاف
export default async (req) => {
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const nm = String(body.name || "").trim().slice(0, 80);
  if (nm) {
    const store = getStore("live");
    const obj = (await store.get("all", { type: "json" })) || {};
    if (obj[nm]) {
      delete obj[nm];
      await store.setJSON("all", obj);
    }
  }
  return json({ ok: true });
};
