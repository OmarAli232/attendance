import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

// حالات الصفحة
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
  const [message, setMessage] = useState("Checking you in…");
  const [deviceLabel] = useState(getDeviceLabel);
  const [liveOn, setLiveOn] = useState(false);
  const startedRef = useRef(false);
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);

  // صفحة الموظف إنجليزي (من الشمال لليمين)
  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    document.title = "Attendance Check-in";
  }, []);

  // لو اللينك فيه اسم نستخدمه، غير كده اسم ثابت للجهاز
  function nameNow() {
    return empFromLink || deviceLabel;
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

  function capture() {
    const name = nameNow();
    if (!("geolocation" in navigator)) {
      setState(ERROR);
      setMessage("Your device doesn't support location.");
      return;
    }

    setState(LOADING);
    setMessage('Checking you in… Tap "Allow" if your browser asks for location.');

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
          setState(OK);
          // نبدأ الموقع المباشر بعد ما الحضور يتسجّل
          startLive(name);
        } catch {
          setState(ERROR);
          setMessage("Something went wrong while sending. Check your internet and try again.");
        }
      },
      (err) => {
        setState(ERROR);
        if (err.code === 1)
          setMessage(
            'Location access is required to check in. Allow location in your browser settings, then tap "Try again".'
          );
        else if (err.code === 2)
          setMessage("Location is unavailable right now. Make sure GPS is on and try again.");
        else setMessage('It took too long. Tap "Try again".');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  // يبدأ أوتوماتيك أول ما الصفحة تفتح
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    capture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="card">
      <h1>Attendance Check-in</h1>
      {empFromLink && (
        <div className="who">
          Hi <b>{empFromLink}</b>
        </div>
      )}

      <p className="consent">
        Opening this page records your attendance and location. Your location
        keeps updating while this page is open — you can stop it anytime.
      </p>

      {state === LOADING && (
        <div className="status">
          <span className="spin" /> {message}
        </div>
      )}

      {state === OK && (
        <div className="status ok">
          <div className="check">✅</div>
          You're checked in{empFromLink ? `, ${empFromLink}` : ""}.
          {liveOn ? (
            <div className="live-banner">
              <span className="live-dot" /> Location sharing is on while this
              page is open.
              <button className="stop-btn" onClick={stopLive}>
                Stop sharing
              </button>
            </div>
          ) : (
            <div className="muted">Location sharing stopped.</div>
          )}
        </div>
      )}

      {state === ERROR && (
        <>
          <div className="status err">{message}</div>
          <button onClick={capture}>📍 Try again</button>
        </>
      )}
    </main>
  );
}

// اسم ثابت للجهاز لو اللينك مفيهوش اسم (بيتحفظ عشان نفس الجهاز ياخد نفس الاسم كل مرة)
function getDeviceLabel() {
  const ua = navigator.userAgent || "";
  const kind = /iPhone|iPad/i.test(ua)
    ? "iPhone"
    : /Android/i.test(ua)
    ? "Android"
    : /Windows/i.test(ua)
    ? "Windows"
    : /Mac/i.test(ua)
    ? "Mac"
    : "جهاز";
  let id = "";
  try {
    id = localStorage.getItem("deviceId") || "";
    if (!id) {
      id = Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem("deviceId", id);
    }
  } catch {
    id = Math.random().toString(36).slice(2, 6).toUpperCase();
  }
  return `${kind} · جهاز ${id}`;
}
