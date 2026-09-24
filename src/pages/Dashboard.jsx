import React, { useEffect, useRef, useState } from "react";

const POLL_MS = 5000; // بيحدّث كل 5 ثواني

export default function Dashboard() {
  const [pass, setPass] = useState(() => {
    try {
      return sessionStorage.getItem("adminPass") || "";
    } catch {
      return "";
    }
  });
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [live, setLive] = useState([]);
  const timerRef = useRef(null);

  async function load(passcode) {
    try {
      const [res, resLive] = await Promise.all([
        fetch("/api/checkins", { headers: { "x-admin-pass": passcode } }),
        fetch("/api/live", { headers: { "x-admin-pass": passcode } })
      ]);
      if (res.status === 401) {
        setAuthed(false);
        setError("كلمة السر غلط.");
        try {
          sessionStorage.removeItem("adminPass");
        } catch {}
        return;
      }
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setRows(data.checkins || []);
      if (resLive.ok) {
        const dl = await resLive.json();
        setLive(dl.live || []);
      }
      setAuthed(true);
      setError("");
    } catch {
      setError("حصلت مشكلة في الاتصال بالسيرفر.");
    }
  }

  function enter() {
    const p = input.trim();
    if (!p) return;
    setPass(p);
    try {
      sessionStorage.setItem("adminPass", p);
    } catch {}
    load(p);
  }

  // لوحة الأدمن عربي (من اليمين للشمال)
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.title = "لوحة تحكم الحضور";
  }, []);

  // أول تحميل لو فيه كلمة سر محفوظة
  useEffect(() => {
    if (pass) load(pass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تحديث مباشر كل 5 ثواني بعد الدخول
  useEffect(() => {
    if (!authed) return;
    timerRef.current = setInterval(() => load(pass), POLL_MS);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, pass]);

  if (!authed) {
    return (
      <div className="gate">
        <h2>لوحة التحكم 🔒</h2>
        <p>اكتب كلمة السر بتاعتك عشان تشوف تسجيلات الموظفين.</p>
        <input
          type="password"
          placeholder="كلمة السر"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enter()}
        />
        <button onClick={enter}>دخول</button>
        {error && <div className="gate-err">{error}</div>}
      </div>
    );
  }

  const today = countToday(rows);

  return (
    <div className="wrap">
      <header className="dash-head">
        <h1>حضور الموظفين</h1>
        <div className="stats">
          <span className="pill">
            النهارده <b>{today}</b>
          </span>
          <span className="pill">
            الكل <b>{rows.length}</b>
          </span>
          <span className="pill">
            <span className="live">
              <span className="dot" /> مباشر
            </span>
          </span>
        </div>
      </header>

      {/* ===== المواقع المباشرة (لايف) ===== */}
      <section className="live-section">
        <h2 className="sec-title">
          <span className="dot" /> الموقع المباشر
          <span className="sec-count">
            {live.filter((l) => l.online).length} أونلاين دلوقتي
          </span>
        </h2>
        {live.length === 0 ? (
          <div className="empty small">
            مفيش حد بيشارك موقعه المباشر دلوقتي.
          </div>
        ) : (
          <div className="list">
            {live.map((l) => (
              <div className={"row" + (l.online ? "" : " off")} key={"live-" + l.name}>
                <div className={"av" + (l.online ? " on" : "")}>
                  {(l.name || "؟").trim().charAt(0)}
                </div>
                <div className="info">
                  <div className="nm">
                    {l.name}{" "}
                    {l.online ? (
                      <span className="badge on">مباشر الآن</span>
                    ) : (
                      <span className="badge">غير متصل</span>
                    )}
                  </div>
                  <div className="meta">
                    🕒 آخر تحديث {timeAgo(l.updatedAt)}
                    <br />
                    📍{" "}
                    <span className="coords">
                      {(+l.lat).toFixed(6)}, {(+l.lng).toFixed(6)}
                    </span>{" "}
                    · دقة ~{l.accuracy || "?"} م
                  </div>
                </div>
                <div className="go">
                  <a
                    href={`https://www.google.com/maps?q=${l.lat},${l.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🗺️ تابع مكانه
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <h2 className="sec-title">📋 سجل الحضور</h2>
      {rows.length === 0 ? (
        <div className="empty">
          لسه مفيش تسجيلات. ابعت اللينك للموظفين وهتظهر هنا لحظياً.
        </div>
      ) : (
        <div className="list">
          {rows.map((r) => (
            <div className="row" key={r.id}>
              <div className="av">{(r.name || "؟").trim().charAt(0)}</div>
              <div className="info">
                <div className="nm">{r.name}</div>
                <div className="meta">
                  🕒 {fmt(r.createdAt)} ·{" "}
                  <span className="ago">{timeAgo(r.createdAt)}</span>
                  <br />
                  {r.address && <>🏠 {r.address}<br /></>}
                  📍{" "}
                  <span className="coords">
                    {(+r.lat).toFixed(6)}, {(+r.lng).toFixed(6)}
                  </span>{" "}
                  · دقة ~{r.accuracy || "?"} م
                </div>
              </div>
              <div className="go">
                <a
                  href={`https://www.google.com/maps?q=${r.lat},${r.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🗺️ افتح المكان
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function countToday(rows) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return rows.filter((r) => new Date(r.createdAt) >= start).length;
}

function fmt(iso) {
  const t = new Date(iso);
  if (isNaN(t)) return "—";
  return t.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function timeAgo(iso) {
  const t = new Date(iso);
  if (isNaN(t)) return "دلوقتي";
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "من ثواني";
  if (s < 3600) return "من " + Math.floor(s / 60) + " دقيقة";
  if (s < 86400) return "من " + Math.floor(s / 3600) + " ساعة";
  return "من " + Math.floor(s / 86400) + " يوم";
}
