import { getStore } from "@netlify/blobs";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// GET /api/checkins — سجل الحضور (للوحة التحكم بكلمة السر بس)
export default async (req) => {
  const pass = req.headers.get("x-admin-pass") || "";
  if (pass !== (process.env.ADMIN_PASSCODE || "غيّر_دي_1234")) {
    return json({ error: "غير مصرّح" }, 401);
  }
  const store = getStore("checkins");
  const list = (await store.get("all", { type: "json" })) || [];
  return json({ checkins: list.slice(0, 500) });
};
