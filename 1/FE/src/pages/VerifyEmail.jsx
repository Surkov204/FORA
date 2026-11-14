import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API = "/api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function VerifyEmail() {
  const q = useQuery();
  const navigate = useNavigate();

  const userId = q.get("userId");
  const token = q.get("token");

  const [status, setStatus] = useState("loading"); // loading | ok | err
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState("");
  const [loadingResend, setLoadingResend] = useState(false);

  // Guard chống StrictMode dev gọi useEffect 2 lần
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function run() {
      if (!userId || !token) {
        setStatus("err");
        setMsg("Thiếu userId hoặc token trong link.");
        return;
      }

      const url = `${API}/auth/verify-email?userId=${encodeURIComponent(
        userId
      )}&token=${encodeURIComponent(token)}`;

      setDetail(url);

      try {
        const res = await fetch(url, { method: "GET" });

        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {}

        if (!res.ok) {
          setStatus("err");
          setMsg(data?.message || text || "Xác thực thất bại.");
          return;
        }

        const serverMsg = data?.message || text || "Xác thực email thành công ✅";
        setStatus("ok");
        setMsg(serverMsg);
      } catch {
        setStatus("err");
        setMsg("Không kết nối được server.");
      }
    }

    run();
  }, [userId, token]);

  const resend = async () => {
    // Trang này không có email để resend, nên hướng dẫn hợp lý.
    setLoadingResend(true);
    setTimeout(() => {
      setLoadingResend(false);
      setMsg("Vào Login/Register để bấm Resend (vì cần email) nha bro 😄");
    }, 600);
  };

  const badge =
    status === "loading" ? (
      <div className="vfy-badge loading">
        <i className="fa-solid fa-circle-notch fa-spin" />
        <span>Verifying</span>
      </div>
    ) : status === "ok" ? (
      <div className="vfy-badge ok">
        <i className="fa-solid fa-circle-check" />
        <span>Verified</span>
      </div>
    ) : (
      <div className="vfy-badge err">
        <i className="fa-solid fa-circle-xmark" />
        <span>Failed</span>
      </div>
    );

  return (
    <div className="vfy">
      <div className="vfy-shell">
        {/* left: brand/hero */}
        <div className="vfy-left">
          <div className="vfy-top">
            <div className="vfy-brand">
              <div className="vfy-logo">
                <img
                  src="https://res.cloudinary.com/do48qpmut/image/upload/v1769763432/seh3vzxmptutookzzbjb.jpg"
                  alt="Fora"
                />
              </div>
              <div className="vfy-brandText">
                <div className="vfy-name">Fora</div>
                <div className="vfy-tag">Email verification</div>
              </div>
            </div>

            <div className="vfy-chips">
              <span className="chip"><i className="fa-solid fa-shield-halved" /> Secure</span>
              <span className="chip"><i className="fa-solid fa-envelope" /> Mail</span>
            </div>
          </div>

          <div className="vfy-hero">
            Verify your <span>email</span>.
          </div>
          <div className="vfy-sub">
            Một bước cuối để kích hoạt account và bắt đầu đăng bài.
          </div>

          <div className="vfy-miniCard">
            <div className="mc-row">
              <div className="mc-dot" />
              <div className="mc-line" />
            </div>
            <div className="mc-body" />
            <div className="mc-row" style={{ marginTop: 12 }}>
              <div className="mc-line sm" />
              <div className="mc-line sm" />
              <div className="mc-line sm" />
            </div>
          </div>

          <div className="vfy-foot">
            Tip: nếu link mở trên thiết bị khác, hãy copy link và mở trên browser.
          </div>
        </div>

        {/* right: status card */}
        <div className="vfy-right">
          <div className="vfy-card">
            <div className="vfy-cardHead">
              {badge}
              <div className="vfy-title">
                {status === "loading"
                  ? "Checking link…"
                  : status === "ok"
                  ? "Email verified ✅"
                  : "Verification failed ❌"}
              </div>
              <div className="vfy-desc">
                {status === "loading"
                  ? "Đang xác thực email của bạn…"
                  : msg}
              </div>
            </div>

            {/* progress / details */}
            {status === "loading" ? (
              <div className="vfy-progress">
                <div className="bar" />
              </div>
            ) : null}

            {status === "err" && detail ? (
              <div className="vfy-debug">
                <div className="dbg-head">Debug</div>
                <code className="dbg-code">{detail}</code>
              </div>
            ) : null}

            {/* actions */}
            <div className="vfy-actions">
              {status === "ok" ? (
                <>
                  <button className="btn primary" onClick={() => navigate("/login")}>
                    Go to Login <span className="arr">→</span>
                  </button>
                  <button className="btn ghost" onClick={() => navigate("/auth")}>
                    Back to Auth
                  </button>
                </>
              ) : status === "err" ? (
                <>
                  <button className="btn primary" onClick={() => navigate("/login")}>
                    Back to Login <span className="arr">→</span>
                  </button>
                  <button className="btn ghost" onClick={resend} disabled={loadingResend}>
                    {loadingResend ? "Sending…" : "Resend verification"}
                  </button>
                </>
              ) : (
                <button className="btn ghost" onClick={() => navigate("/login")}>
                  Cancel & go login
                </button>
              )}
            </div>

            {/* bottom note */}
            <div className="vfy-note">
              Nếu button không hoạt động, hãy mở link verify trong email bằng trình duyệt.
            </div>
          </div>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
:root{
  --bg:#000;
  --card:#16181c;
  --border:#2f3336;
  --text:#e7e9ea;
  --dim:#71767b;
  --blue:#1d9bf0;
  --pink:#f91880;
  --green:#00ba7c;
  --r: 22px;
}
*{box-sizing:border-box;}

.vfy{
  min-height:100vh;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  display:grid;
  place-items:center;
  padding:24px;
  position:relative;
  overflow:hidden;
}
.vfy::before{
  content:"";
  position:absolute; inset:-320px;
  background:
    radial-gradient(900px 520px at 18% 20%, rgba(29,155,240,.22), transparent 62%),
    radial-gradient(720px 480px at 86% 28%, rgba(249,24,128,.14), transparent 62%),
    radial-gradient(900px 520px at 30% 92%, rgba(0,186,124,.10), transparent 62%),
    radial-gradient(1000px 650px at 55% 55%, rgba(255,255,255,.05), transparent 70%);
  pointer-events:none;
}
.vfy::after{
  content:"";
  position:absolute; inset:0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
  opacity:.08; mix-blend-mode: overlay;
  pointer-events:none;
}

.vfy-shell{
  width:min(980px, 95vw);
  min-height: 560px;
  border:1px solid rgba(255,255,255,.10);
  border-radius: var(--r);
  background: rgba(22,24,28,.72);
  backdrop-filter: blur(12px);
  box-shadow: 0 30px 120px rgba(0,0,0,.65);
  overflow:hidden;
  display:grid;
  grid-template-columns: 1.05fr 0.95fr;
}

/* left */
.vfy-left{
  padding:34px;
  border-right:1px solid rgba(255,255,255,.08);
  position:relative;
  overflow:hidden;
}
.vfy-left::after{
  content:"";
  position:absolute; inset:-120px;
  background:
    radial-gradient(700px 380px at 15% 20%, rgba(29,155,240,.18), transparent 60%),
    radial-gradient(600px 360px at 70% 10%, rgba(249,24,128,.10), transparent 60%),
    radial-gradient(700px 420px at 25% 90%, rgba(0,186,124,.08), transparent 60%);
  opacity:.9;
  pointer-events:none;
}

.vfy-top{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  position:relative; z-index:1;
}
.vfy-brand{
  display:flex; align-items:center; gap:12px;
  padding:10px 12px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.12);
  background: rgba(0,0,0,.22);
}
.vfy-logo{
  width:36px;height:36px;border-radius:14px;
  border:1px solid rgba(255,255,255,.12);
  overflow:hidden;
  background: rgba(255,255,255,.06);
}
.vfy-logo img{width:100%;height:100%;display:block;object-fit:cover;}
.vfy-name{font-weight:950;font-size:14px;line-height:1.05;}
.vfy-tag{font-size:12px;color:rgba(231,233,234,.55);margin-top:2px;}

.vfy-chips{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.chip{
  font-size:12px;font-weight:900;color:rgba(231,233,234,.85);
  border:1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.22);
  padding:8px 10px;border-radius:999px;
}
.chip i{opacity:.9;margin-right:6px;}

.vfy-hero{
  margin-top:26px;
  font-size:44px;
  line-height:1.02;
  font-weight:950;
  letter-spacing:-1.2px;
  position:relative;
  z-index:1;
}
.vfy-hero span{
  background: linear-gradient(90deg, #fff, rgba(231,233,234,.60));
  -webkit-background-clip:text;
  background-clip:text;
  color:transparent;
}
.vfy-sub{
  margin-top:14px;
  max-width: 430px;
  color: rgba(231,233,234,.70);
  font-size:14px;
  line-height:1.6;
  position:relative; z-index:1;
}

.vfy-miniCard{
  margin-top:22px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.26);
  border-radius: 18px;
  padding:16px;
  max-width: 460px;
  position:relative; z-index:1;
}
.mc-row{display:flex;gap:10px;align-items:center;margin-bottom:12px;}
.mc-dot{width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.10);}
.mc-line{height:10px;border-radius:999px;background:rgba(255,255,255,.10);flex:1;}
.mc-line.sm{width:46%;flex:unset}
.mc-body{height:64px;border-radius:14px;background:rgba(255,255,255,.06)}
.vfy-foot{
  margin-top:14px;
  font-size:12px;
  color: rgba(231,233,234,.55);
  position:relative; z-index:1;
}

/* right */
.vfy-right{
  padding:28px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.vfy-card{
  width: min(420px, 100%);
  border-radius: 18px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.26);
  box-shadow: 0 24px 90px rgba(0,0,0,.45);
  padding:18px;
}
.vfy-cardHead{padding:6px 4px 0;}
.vfy-title{
  margin-top:14px;
  font-size:22px;
  font-weight:950;
  letter-spacing:-.3px;
}
.vfy-desc{
  margin-top:8px;
  font-size:13px;
  color: rgba(231,233,234,.65);
  line-height:1.6;
}

/* badge */
.vfy-badge{
  display:inline-flex; align-items:center; gap:10px;
  padding:10px 12px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.22);
  font-weight:950;
}
.vfy-badge i{font-size:14px;}
.vfy-badge.loading{color: rgba(231,233,234,.9);}
.vfy-badge.ok{color: rgba(0,186,124,.95);}
.vfy-badge.err{color: rgba(255,59,48,.95);}

/* progress */
.vfy-progress{
  margin:16px 4px 0;
  height:10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background: rgba(0,0,0,.18);
  overflow:hidden;
}
.vfy-progress .bar{
  height:100%;
  width:46%;
  background: rgba(29,155,240,.7);
  border-radius:999px;
  animation: vfyInd 1.1s ease-in-out infinite alternate;
}
@keyframes vfyInd{ from{transform:translateX(-20%);} to{transform:translateX(120%);} }

/* debug */
.vfy-debug{
  margin-top:14px;
  border:1px solid rgba(255,255,255,.10);
  border-radius:14px;
  background: rgba(255,255,255,.04);
  padding:12px;
}
.dbg-head{font-size:12px;color:rgba(231,233,234,.65);font-weight:900;margin-bottom:8px;letter-spacing:.10em;text-transform:uppercase;}
.dbg-code{display:block;word-break:break-all;font-size:12px;color:rgba(231,233,234,.75);}

.vfy-actions{
  margin-top:16px;
  display:grid;
  gap:10px;
}
.btn{
  width:100%;
  border-radius:999px;
  padding:12px 14px;
  font-weight:950;
  cursor:pointer;
  border:1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.06);
  color: rgba(231,233,234,.92);
}
.btn:disabled{opacity:.55;cursor:not-allowed;}
.btn:hover{background:rgba(255,255,255,.10);}
.btn.primary{
  background: var(--blue);
  border-color: rgba(29,155,240,.35);
  color:#fff;
}
.btn.primary:hover{filter:brightness(1.03);}
.arr{margin-left:6px;opacity:.9;}
.vfy-note{
  margin-top:12px;
  font-size:12px;
  color: rgba(231,233,234,.55);
  text-align:center;
  line-height:1.5;
}

@media (max-width: 860px){
  .vfy-shell{grid-template-columns:1fr; min-height:auto;}
  .vfy-left{display:none;}
  .vfy-right{padding:20px;}
}
`;
