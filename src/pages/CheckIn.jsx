import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

// حالات الصفحة
const IDLE = "idle";
const LOADING = "loading";
const OK = "ok";
const ERROR = "error";

export default function CheckIn() {
  const [params] = useSearchParams();
  const empFromLink = (
    params.get("emp") ||
    params.get("name") ||
    params.get("id") ||
    ""
  ).trim();

  const [state, setState] = useState(LOADING);
  const [message, setMessage] = useState("بنسجّل حضورك…");
  const [result, setResult] = useState(null); // { address, lat, lng, accuracy }
  const [typedName, setTypedName] = useState("");
  const [liveOn, setLiveOn] = useState(false);
  const startedRef = useRef(false);
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);

  function nameNow() {
    return empFromLink || typedName.trim();
  }

  // ===== الموقع المباشر (لايف) =====
  function startLive(name) {
    if (!("geolocation" in navigator) || watchRef.current != null) return;
    setLiveOn(true);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        // مش أكتر من مرة كل 5 ثواني عشان منتقلش على السيرفر
        if (now - lastSentRef.current < 5000) return;
        lastSentRef.current = now;
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            lat,
            lng,
            accuracy: Math.round(accuracy || 0)
          })
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }

  function stopLive() {
    const name = nameNow();
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setLiveOn(false);
    if (name) {
      // sendBeacon بيوصل حتى وإحنا بنقفل الصفحة
      try {
        const blob = new Blob([JSON.stringify({ name })], {
          type: "application/json"
        });
        navigator.sendBeacon("/api/live/stop", blob);
      } catch {
        fetch("/api/live/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
          keepalive: true
        }).catch(() => {});
      }
    }
  }

  // لو الموظف قفل الصفحة يتوقف اللايف
  useEffect(() => {
    const onHide = () => {
      if (watchRef.current != null) stopLive();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function capture() {
    const name = nameNow();
    if (!name) {
      setState(ERROR);
      setMessage("اللينك ده مش مربوط باسم. اكتب اسمك وبعدين اضغط سجّل حضوري.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setState(ERROR);
      setMessage("جهازك مش بيدعم تحديد الموقع.");
      return;
    }

    setState(LOADING);
    setMessage('بنسجّل حضورك… اضغط "سماح" لو ظهرلك سؤال بالموقع.');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        try {
          const res = await fetch("/api/checkin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              lat,
              lng,
              accuracy: Math.round(accuracy || 0)
            })
          });
          if (!res.ok) throw new Error("bad_status");
          const data = await res.json();
          setResult({
            address: data.address || "",
            lat,
            lng,
            accuracy: Math.round(accuracy || 0)
          });
          setState(OK);
          // نبدأ الموقع المباشر بعد ما الحضور يتسجّل
          startLive(name);
        } catch (err) {
          setState(ERROR);
          setMessage("حصلت مشكلة وقت الإرسال. تأكد إن النت شغّال وحاول تاني.");
        }
      },
      (err) => {
        setState(ERROR);
        if (err.code === 1)
          setMessage(
            'لازم تسمح بالوصول للموقع عشان يتسجّل حضورك. افتح إعدادات المتصفح واسمح بالموقع، وبعدين اضغط "حاول تاني".'
          );
        else if (err.code === 2)
          setMessage("الموقع مش متاح دلوقتي. تأكد إن الـ GPS مفعّل وحاول في مكان مكشوف.");
        else setMessage('أخد وقت طويل. اضغط "حاول تاني".');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // يبدأ أوتوماتيك أول ما الصفحة تفتح — بس لو اللينك فيه اسم
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (empFromLink) capture();
    else {
      setState(IDLE);
      setMessage("اكتب اسمك عشان نسجّل حضورك.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapsLink = result
    ? `https://www.google.com/maps?q=${result.lat},${result.lng}`
    : "#";

  return (
    <main className="card">
      <div className="logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>

      <h1>تسجيل الحضور</h1>
      {empFromLink && (
        <div className="who">
          أهلاً <b>{empFromLink}</b>
        </div>
      )}

      <p className="consent">
        بفتحك للصفحة دي هيتسجّل اسمك وموقعك الحالي عشان إثبات الحضور، وهيفضل
        موقعك بيتحدّث مباشرة طول ما الصفحة مفتوحة. تقدر توقفه في أي وقت.
      </p>

      {state === LOADING && (
        <div className="status">
          <span className="spin" /> {message}
        </div>
      )}

      {state === OK && result && (
        <div className="status ok">
          <div className="check">✅</div>
          تمام يا {nameNow()}، اتسجّل حضورك ووصل موقعك.
          {result.address && (
            <div className="addr">📍 {result.address}</div>
          )}
          <div className="muted">دقة الموقع تقريباً {result.accuracy} متر.</div>
          <a className="maplink" href={mapsLink} target="_blank" rel="noopener noreferrer">
            افتح مكانك على الخريطة
          </a>

          {liveOn && (
            <div className="live-banner">
              <span className="live-dot" /> موقعك بيتبعت مباشرة دلوقتي طول ما
              الصفحة مفتوحة.
              <button className="stop-btn" onClick={stopLive}>
                إيقاف المشاركة
              </button>
            </div>
          )}
          {!liveOn && (
            <div className="muted">تم إيقاف مشاركة الموقع المباشر.</div>
          )}
        </div>
      )}

      {state === ERROR && <div className="status err">{message}</div>}
      {state === IDLE && <div className="status">{message}</div>}

      {!empFromLink && state !== OK && (
        <div className="fb">
          <input
            type="text"
            placeholder="اكتب اسمك"
            autoComplete="name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
          />
        </div>
      )}

      {(state === ERROR || state === IDLE) && (
        <button onClick={capture}>
          {empFromLink ? "📍 حاول تاني" : "سجّل حضوري"}
        </button>
      )}
    </main>
  );
}
