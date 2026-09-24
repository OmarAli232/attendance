import { getStore } from "@netlify/blobs";

// تحويل الإحداثيات لعنوان بالشارع (OpenStreetMap - مجاني بدون مفتاح)
async function reverseGeocode(lat, lng) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&accept-language=ar&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": "AttendanceCheckin/1.0 (employee attendance)" }
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.display_name || "";
  } catch {
    return "";
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// POST /api/checkin — استقبال تسجيل حضور من الموظف
export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);

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

  const address = await reverseGeocode(la, ln);

  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: nm,
    lat: la,
    lng: ln,
    accuracy: Math.round(Number(body.accuracy) || 0),
    address,
    createdAt: new Date().toISOString()
  };

  const store = getStore("checkins");
  const list = (await store.get("all", { type: "json" })) || [];
  list.unshift(record); // الأحدث الأول
  if (list.length > 5000) list.length = 5000;
  await store.setJSON("all", list);

  return json({ ok: true, address });
};
