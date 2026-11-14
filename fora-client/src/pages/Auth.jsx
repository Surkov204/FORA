import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";
const API = "/api";

/* utils */
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const scorePassword = (pw) => {
    let s = 0;
    if (!pw) return 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
};
const strengthLabel = (score) => (score <= 1 ? "Weak" : score === 2 ? "Okay" : score === 3 ? "Good" : "Strong");

export default function Auth() {
    const navigate = useNavigate();

    // tab: "login" | "register"
    const [tab, setTab] = useState("login");

    // login
    const [emailOrPhone, setEmailOrPhone] = useState("");
    const [password, setPassword] = useState("");

    // register
    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [cf, setCf] = useState("");
    const [agree, setAgree] = useState(false);

    // shared
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [toast, setToast] = useState("");
    const [success, setSuccess] = useState(null); // register success

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(""), 2500);
        return () => clearTimeout(t);
    }, [toast]);

    // register checks
    const pwScore = useMemo(() => scorePassword(pw), [pw]);
    const checks = useMemo(() => {
        const emailOk = isValidEmail(email);
        const lenOk = pw.length >= 8;
        const mixOk = /[A-Z]/.test(pw) && /[0-9]/.test(pw);
        const matchOk = cf && cf === pw;
        return { emailOk, lenOk, mixOk, matchOk };
    }, [email, pw, cf]);

    const canLogin = useMemo(() => {
        return emailOrPhone.trim().length > 0 && password.trim().length >= 1 && !loading;
    }, [emailOrPhone, password, loading]);

    const canRegister = useMemo(() => {
        return checks.emailOk && checks.lenOk && checks.matchOk && agree && !loading;
    }, [checks, agree, loading]);

    // --- FIXED SWITCH TAB FUNCTION ---
    const switchTab = (next) => {
        setServerError("");
        setToast("");
        setSuccess(null); // Reset success state so the form reappears
        setTab(next);
    };

    const doLogin = async (e) => {
        e.preventDefault();
        setServerError("");

        if (!canLogin) {
            setToast("Điền đủ thông tin trước đã 😄");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailOrPhone, password }),
            });

            let data = null;
            let text = "";
            try {
                data = await res.json();
            } catch {
                text = await res.text().catch(() => "");
            }

            if (!res.ok) {
                const msg = data?.message || text || "Đăng nhập thất bại";
                if (res.status === 403 && data?.code === "EMAIL_NOT_VERIFIED") {
                    setServerError(msg);
                    setToast("Email chưa verify. Chuyển sang Register để gửi lại...");
                    setTab("register");
                    setSuccess({ message: msg, email: emailOrPhone.trim() });
                    return;
                }
                setServerError(msg);
                return;
            }

            if (!data?.token) {
                setServerError(data?.message || "Đăng nhập thất bại");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("currentUser", JSON.stringify(data.user));
            setToast("Đăng nhập OK ✅");
            navigate("/profile");
        } catch {
            setServerError("Không kết nối được server");
        } finally {
            setLoading(false);
        }
    };

    const doRegister = async (e) => {
        e.preventDefault();
        setServerError("");

        if (!canRegister) {
            setServerError("Điền đúng & đủ trước đã bro 😅");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password: pw }),
            });

            let data = null;
            let text = "";
            try {
                data = await res.json();
            } catch {
                text = await res.text().catch(() => "");
            }

            if (!res.ok) {
                setServerError(data?.message || text || "Đăng ký thất bại");
                return;
            }

            setSuccess({
                message: data?.message || "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
                email: email.trim(),
            });
            setToast("Registered ✅ Check email");
        } catch {
            setServerError("Không kết nối được server");
        } finally {
            setLoading(false);
        }
    };

    const resend = async () => {
        if (!success?.email) return;
        setServerError("");

        try {
            setLoading(true);
            const res = await fetch(`${API}/auth/resend-verification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: success.email }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                setServerError(data?.message || "Gửi lại thất bại");
                return;
            }

            setSuccess((s) => ({
                ...s,
                message: data?.message || "Đã gửi lại email xác thực. Check inbox nha 😄",
            }));
            setToast("Resent ✅");
        } catch {
            setServerError("Không kết nối được server");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="authv2">
            <div className="authv2-shell">
                {/* LEFT */}
                <div className="authv2-left alt">
                    <div className="authv2-top">
                        <div className="authv2-badge">
                            <img
                                src="https://res.cloudinary.com/do48qpmut/image/upload/v1769335183/fora/img_1769335177250.jpg"
                                className="logo"
                                alt="Fora"
                            />

                        </div>

                        <div className="authv2-chips">
                            <span className="chip">
                                <i className="fa-solid fa-bolt" /> Fast
                            </span>
                            <span className="chip">
                                <i className="fa-solid fa-lock" /> Secure
                            </span>
                            <span className="chip">
                                <i className="fa-solid fa-users" /> Social
                            </span>

                        </div>
                    </div>

                    <div className="authv2-hero2">
                        Share your <span className="hi">moment</span>
                        <span className="underline" />
                    </div>

                    <div className="authv2-sub2">
                        Đăng nhập để bắt đầu đăng bài, theo dõi bạn bè và tham gia thảo luận.
                    </div>

                    <div className="authv2-bullets">
                        <div className="b">
                            <span className="fa-dot blue">
                                <i className="fa-solid fa-pen-nib" />
                            </span>

                            <div>
                                <div className="b-title">Đăng bài nhanh</div>
                                <div className="b-desc">Composer tối giản, focus nội dung.</div>
                            </div>
                        </div>

                        <div className="b">
                            <span className="fa-dot pink">
                                <i className="fa-solid fa-bolt" />
                            </span>

                            <div>
                                <div className="b-title">Tương tác real-time</div>
                                <div className="b-desc">Like, comment, follow mượt.</div>
                            </div>
                        </div>

                        <div className="b">
                            <span className="fa-dot green">
                                <i className="fa-solid fa-user" />
                            </span>

                            <div>
                                <div className="b-title">Profile gọn gàng</div>
                                <div className="b-desc">Đúng vibe X nhưng có nét riêng.</div>
                            </div>
                        </div>
                    </div>

                    <div className="authv2-layer">
                        <div className="cardA">
                            <div className="row">
                                <div className="ava" />
                                <div className="l" />
                            </div>
                            <div className="big" />
                            <div className="mini">
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>

                        <div className="cardB">
                            <div className="row">
                                <div className="ava sm" />
                                <div className="l sm" />
                            </div>
                            <div className="big sm" />
                            <div className="mini">
                                <span />
                                <span />
                                <span />
                            </div>
                        </div>

                        <div className="shine" />
                    </div>

                    <div className="authv2-footnote">
                        <span className="muted">New here?</span> Create account in ~1 minute.
                    </div>
                </div>


                {/* RIGHT */}
                <div className="authv2-right">
                    {/* switch pill */}
                    <div className="seg">
                        <button
                            type="button"
                            className={`seg-btn ${tab === "login" ? "on" : ""}`}
                            onClick={() => switchTab("login")}
                            disabled={loading}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            className={`seg-btn ${tab === "register" ? "on" : ""}`}
                            onClick={() => switchTab("register")}
                            disabled={loading}
                        >
                            Register
                        </button>
                        <span className={`seg-ind ${tab}`} aria-hidden="true" />
                    </div>

                    {serverError ? (
                        <div className="authv2-alert">
                            <b>Lỗi:</b> {serverError}
                        </div>
                    ) : null}

                    {/* stage */}
                    <div className={`stage ${tab}`}>
                        {/* LOGIN */}
                        <div className="panel">
                            <h1 className="authv2-title">Welcome back</h1>
                            <p className="authv2-desc">Đăng nhập để vào Fora</p>

                            <form className="authv2-form" onSubmit={doLogin}>
                                <div className="f2">
                                    <label>Email</label>
                                    <input
                                        value={emailOrPhone}
                                        onChange={(e) => setEmailOrPhone(e.target.value)}
                                        autoComplete="username"
                                        placeholder="email@domain.com"
                                    />
                                </div>

                                <div className="f2">
                                    <label>Password</label>
                                    <div className="row2">
                                        <input
                                            className="grow"
                                            type={showPw ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="current-password"
                                            placeholder="••••••••"
                                        />
                                        <button type="button" className="ghost2" onClick={() => setShowPw((v) => !v)}>
                                            {showPw ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                </div>

                                <button className="primary2" disabled={!canLogin} type="submit">
                                    {loading ? "Logging in..." : "Login"}
                                    <span style={{ opacity: 0.8 }}>{loading ? "⏳" : "→"}</span>
                                </button>


                                <div className="forgotRow">
                                    <button type="button" className="link2" onClick={() => navigate("/forgot-password")} disabled={loading}>
                                        Forgot password?
                                    </button>
                                </div>


                                <div className="switch2">
                                    <span>Chưa có tài khoản?</span>
                                    <button type="button" onClick={() => switchTab("register")}>
                                        Register
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* REGISTER */}
                        <div className="panel">
                            <h1 className="authv2-title">Create account</h1>
                            <p className="authv2-desc">Chỉ 1 phút là xong 😄</p>

                            {success ? (
                                <div className="done">
                                    <div className="done-title">Registered ✅</div>
                                    <div className="done-text">{success.message}</div>

                                    <div className="row3">
                                        <button className="ghost2" type="button" onClick={resend} disabled={loading}>
                                            {loading ? "Sending..." : "Resend verification"}
                                        </button>
                                        <button className="primary2" type="button" onClick={() => switchTab("login")}>
                                            Back to Login <span style={{ opacity: 0.8 }}>→</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form className="authv2-form" onSubmit={doRegister}>
                                    <div className="f2">
                                        <label>Email</label>
                                        <input
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            autoComplete="email"
                                            placeholder="email@domain.com"
                                        />
                                        <div className={`hint2 ${checks.emailOk ? "ok" : ""}`}>
                                            {email ? (checks.emailOk ? "Email hợp lệ" : "Email chưa đúng") : "VD: email@domain.com"}
                                        </div>
                                    </div>

                                    <div className="f2">
                                        <label>Password</label>
                                        <div className="row2">
                                            <input
                                                className="grow"
                                                type={showPw ? "text" : "password"}
                                                value={pw}
                                                onChange={(e) => setPw(e.target.value)}
                                                autoComplete="new-password"
                                                placeholder="tối thiểu 8 ký tự"
                                            />
                                            <button type="button" className="ghost2" onClick={() => setShowPw((v) => !v)}>
                                                {showPw ? "Hide" : "Show"}
                                            </button>
                                        </div>

                                        <div className="meter2">
                                            <div className="track2">
                                                <div className={`fill2 s${pwScore}`} style={{ width: `${(pwScore / 4) * 100}%` }} />
                                            </div>
                                            <span className="mt2">{pw ? strengthLabel(pwScore) : "—"}</span>
                                        </div>
                                    </div>

                                    <div className="f2">
                                        <label>Confirm</label>
                                        <input
                                            type={showPw ? "text" : "password"}
                                            value={cf}
                                            onChange={(e) => setCf(e.target.value)}
                                            autoComplete="new-password"
                                            placeholder="nhập lại mật khẩu"
                                        />
                                        <div className={`hint2 ${checks.matchOk ? "ok" : ""}`}>
                                            {cf ? (checks.matchOk ? "Khớp mật khẩu" : "Chưa khớp") : "Nhập lại cho chắc"}
                                        </div>
                                    </div>

                                    <label className="agree2">
                                        <input
                                            type="checkbox"
                                            checked={agree}
                                            onChange={(e) => setAgree(e.target.checked)}
                                        />
                                        <span className="ck" aria-hidden="true" />
                                        <span className="agree-text">
                                            Đồng ý <b>Terms</b> & <b>Privacy</b>
                                        </span>
                                    </label>


                                    <button className="primary2" disabled={!canRegister} type="submit">
                                        {loading ? "Creating..." : "Create account"}
                                        <span style={{ opacity: 0.8 }}>{loading ? "⏳" : "→"}</span>
                                    </button>

                                    <div className="switch2">
                                        <span>Đã có tài khoản?</span>
                                        <button type="button" onClick={() => switchTab("login")}>
                                            Login
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {toast ? <div className="toast2">{toast}</div> : null}
                </div>
            </div>
            {/* 
            <style>{css}</style> */}
        </div>
    );
}

// const css = `
// :root{
//   --bg:#000;
//   --card:#16181c;
//   --border:#2f3336;
//   --text:#e7e9ea;
//   --dim:#71767b;
//   --blue:#1d9bf0;
//   --r: 22px;
// }
// *{box-sizing:border-box;} /* Important fix for layout */


// .authv2{
//   min-height:100vh;
//   background: var(--bg);
//   color: var(--text);
//   font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
//   display:grid;
//   place-items:center;
//   padding:24px;
//   overflow:hidden;
//   position:relative;
// }
// .authv2::before{
//   content:"";
//   position:absolute; inset:-300px;
//   background:
//     radial-gradient(900px 520px at 20% 20%, rgba(29,155,240,.22), transparent 62%),
//     radial-gradient(720px 480px at 80% 30%, rgba(249,24,128,.14), transparent 62%),
//     radial-gradient(900px 520px at 30% 92%, rgba(0,186,124,.10), transparent 62%),
//     radial-gradient(1000px 650px at 55% 55%, rgba(255,255,255,.05), transparent 70%);
//   pointer-events:none;
// }
// .authv2::after{
//   content:"";
//   position:absolute; inset:0;
//   background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
//   opacity:.08; mix-blend-mode: overlay;
//   pointer-events:none;
// }

// .authv2-shell{
//   width:min(980px, 95vw);
//   min-height: 560px;
//   border:1px solid rgba(255,255,255,.10);
//   border-radius: var(--r);
//   background: rgba(22,24,28,.72);
//   backdrop-filter: blur(12px);
//   box-shadow: 0 30px 120px rgba(0,0,0,.65);
//   overflow:hidden;
//   display:grid;
//   grid-template-columns: 1.1fr 0.9fr;
// }

// /* left */
// .authv2-left{
//   padding:34px;
//   border-right:1px solid rgba(255,255,255,.08);
// }
// .authv2-badge{
//   display:flex;
//   align-items:center;
//   justify-content:center;

//   width:56px;
//   height:56px;

//   border-radius:16px;
//   border:1px solid rgba(255,255,255,.14);
//   background: rgba(0,0,0,.28);

//   box-shadow:
//     0 18px 50px rgba(0,0,0,.55),
//     inset 0 1px 0 rgba(255,255,255,.06);

//   position: relative;
//   overflow:hidden;
// }

// /* glow nhẹ phía sau */
// .authv2-badge::after{
//   content:"";
//   position:absolute;
//   inset:-30px;
//   background: radial-gradient(circle at 30% 30%, rgba(29,155,240,.35), transparent 55%);
//   opacity:.65;
//   pointer-events:none;
// }

// .logo{
//   width:42px;
//   height:42px;
//   border-radius:14px;

//   object-fit:cover;
//   object-position:center;

//   border:1px solid rgba(255,255,255,.18);

//   box-shadow:
//     0 10px 25px rgba(0,0,0,.55),
//     0 0 0 6px rgba(29,155,240,.12);

//   position: relative;
//   z-index: 1;
// }


// .authv2-hero{
//   margin-top:26px;
//   font-size:44px;
//   line-height:1.02;
//   font-weight:950;
//   letter-spacing:-1.2px;
// }
// .authv2-hero span{
//   background: linear-gradient(90deg, #fff, rgba(231,233,234,.65));
//   -webkit-background-clip:text;
//   background-clip:text;
//   color:transparent;
// }
// .authv2-sub{
//   margin-top:14px;
//   max-width: 420px;
//   color: rgba(231,233,234,.70);
//   font-size:14px;
//   line-height:1.6;
// }
// .authv2-preview{
//   margin-top:22px;
//   border:1px solid rgba(255,255,255,.10);
//   background: rgba(0,0,0,.28);
//   border-radius: 18px;
//   padding:16px;
//   max-width: 420px;
// }
// .pv-row{display:flex;gap:10px;align-items:center;margin-bottom:12px;}
// .pv-ava{width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.10);}
// .pv-line{height:10px;border-radius:999px;background:rgba(255,255,255,.10);flex:1;}
// .pv-line.sm{width:46%;flex:unset}
// .pv-body{height:64px;border-radius:14px;background:rgba(255,255,255,.06)}

// /* right */
// .authv2-right{
//   padding:26px;
//   display:flex;
//   flex-direction:column;
//   justify-content:center;
//   position:relative;
// }

// /* segment */
// .seg{
//   position:relative;
//   display:grid;
//   grid-template-columns: 1fr 1fr;
//   gap:6px;
//   border:1px solid rgba(255,255,255,.10);
//   background: rgba(0,0,0,.22);
//   border-radius: 999px;
//   padding:6px;
//   margin-bottom: 12px;
//   overflow:hidden;
// }
// .seg-btn{
//   border:none;
//   background:transparent;
//   color: rgba(231,233,234,.70);
//   padding:10px 10px;
//   border-radius:999px;
//   font-weight:950;
//   cursor:pointer;
//   position:relative;
//   z-index:1;
// }
// .seg-btn.on{ color:#000; }
// .seg-ind{
//   position:absolute;
//   top:6px; bottom:6px;
//   width: calc(50% - 6px);
//   border-radius: 999px;
//   background: #fff;
//   transition: transform .25s ease;
//   pointer-events: none; /* KEY FIX: prevents blocking clicks */
// }
// .seg-ind.login{ transform: translateX(0); }
// .seg-ind.register{ transform: translateX(calc(100% + 6px)); }



// /* titles */
// .authv2-title{font-size:26px;font-weight:950;margin:10px 0 0;}
// .authv2-desc{margin:8px 0 0;color:rgba(231,233,234,.65);font-size:13px;}

// /* error */
// .authv2-alert{
//   margin: 6px 0 10px;
//   background: rgba(255,59,48,.10);
//   border: 1px solid rgba(255,59,48,.35);
//   padding:10px 12px;border-radius:14px;font-size:13px;
// }



// /* ===== stage (ONLY ONE) ===== */
// .stage{
//   position: relative;
//   width: 100%;
//   overflow: hidden;
//   min-height: 560px; /* đủ cho register */
// }

// /* panel chồng lên nhau */
// .stage > .panel{
//   position: absolute;
//   inset: 0;
//   width: 100%;
//   max-width: 100%;
//   padding: 8px 2px 0;
//   transition: transform .45s cubic-bezier(.22,1,.36,1), opacity .25s ease;
// }

// /* LOGIN visible */
// .stage.login > .panel:nth-child(1){
//   transform: translateX(0);
//   opacity: 1;
//   pointer-events: auto;
// }
// .stage.login > .panel:nth-child(2){
//   transform: translateX(40%);
//   opacity: 0;
//   pointer-events: none;
// }

// /* REGISTER visible */
// .stage.register > .panel:nth-child(1){
//   transform: translateX(-40%);
//   opacity: 0;
//   pointer-events: none;
// }
// .stage.register > .panel:nth-child(2){
//   transform: translateX(0);
//   opacity: 1;
//   pointer-events: auto;
// }



// /* form */
// .authv2-form{margin-top:16px;display:grid;gap:12px;}
// .f2 label{
//   display:block;
//   margin:0 0 8px;
//   font-size:12px;
//   color: rgba(231,233,234,.72);
//   letter-spacing:.10em;
//   text-transform:uppercase;
// }
// .f2 input{
//   width:100%;
//   padding:14px 12px;
//   border-radius:14px;
//   border:1px solid rgba(255,255,255,.12);
//   background: rgba(0,0,0,.26);
//   color:var(--text);
//   outline:none;
//   transition:.15s ease;
// }
// .f2 input:focus{
//   border-color: rgba(29,155,240,.75);
//   box-shadow: 0 0 0 4px rgba(29,155,240,.10);
// }
// .row2{display:flex;gap:10px;align-items:center;}
// .row2 .grow{flex:1;}

// .ghost2{
//   border:1px solid rgba(255,255,255,.12);
//   background: rgba(255,255,255,.06);
//   color: rgba(231,233,234,.90);
//   padding:12px 14px;
//   border-radius:999px;
//   cursor:pointer;
//   font-weight:900;
// }
// .ghost2:hover{background:rgba(255,255,255,.10);}

// .primary2{
//   width:100%;
//   border:none;
//   background: var(--blue);
//   color:#fff;
//   padding:12px 14px;
//   border-radius:999px;
//   cursor:pointer;
//   font-weight:950;
//   display:flex;justify-content:center;align-items:center;gap:10px;
// }
// .primary2:disabled{opacity:.55;cursor:not-allowed;}
// .primary2:hover{filter:brightness(1.02);}

// .switch2{
//   margin-top:12px;
//   display:flex;
//   justify-content:center;
//   gap:8px;
//   color: rgba(231,233,234,.65);
//   font-size:13px;
// }
// .switch2 button{
//   border:none;
//   background:transparent;
//   color: var(--blue);
//   font-weight:950;
//   cursor:pointer;
// }
// .switch2 button:hover{text-decoration:underline;}

// .hint2{margin-top:6px;font-size:12px;color:rgba(231,233,234,.55);}
// .hint2.ok{color: rgba(0,186,124,.90);}

// .meter2{display:flex;gap:10px;align-items:center;margin-top:10px;}
// .track2{
//   flex:1;height:10px;border-radius:999px;
//   border:1px solid rgba(255,255,255,.12);
//   background: rgba(0,0,0,.22);
//   overflow:hidden;
// }
// .fill2{height:100%;border-radius:999px;transition: width .18s ease;background: rgba(29,155,240,.55);}
// .fill2.s1{background: rgba(255,59,48,.55);}
// .fill2.s2{background: rgba(255,149,0,.55);}
// .fill2.s3{background: rgba(0,186,124,.60);}
// .fill2.s4{background: rgba(29,155,240,.70);}
// .mt2{width:60px;text-align:right;font-size:12px;color:rgba(231,233,234,.55);}

// .agree2{
//   display:flex;gap:10px;align-items:center;
//   font-size:13px;color: rgba(231,233,234,.85);
//   user-select:none;
// }
// .agree2 input{width:16px;height:16px; accent-color: var(--blue);}

// .done{margin-top:14px;}
// .done-title{font-weight:950;font-size:16px;margin-bottom:6px;}
// .done-text{color:rgba(231,233,234,.65);font-size:13px;line-height:1.6;}
// .row3{display:grid;gap:10px;margin-top:14px;}
// @media (min-width: 520px){ .row3{grid-template-columns:1fr 1fr;} }

// .toast2{
//   margin-top:12px;
//   font-size:13px;
//   padding:10px 12px;
//   border-radius:14px;
//   border:1px solid rgba(255,255,255,.10);
//   background: rgba(255,255,255,.06);
// }

// @media (max-width: 860px){
//   .authv2-shell{grid-template-columns:1fr; min-height:auto;}
//   .authv2-left{display:none;}
// }




// /* ===== LEFT ALT DESIGN ===== */
// .authv2-left.alt{
//   position: relative;
//   padding: 34px;
//   border-right: 1px solid rgba(255,255,255,.08);
//   overflow: hidden;
// }

// .authv2-left.alt::after{
//   content:"";
//   position:absolute;
//   inset:-120px;
//   background:
//     radial-gradient(700px 380px at 15% 20%, rgba(29,155,240,.18), transparent 60%),
//     radial-gradient(600px 360px at 70% 10%, rgba(249,24,128,.10), transparent 60%),
//     radial-gradient(700px 420px at 25% 90%, rgba(0,186,124,.08), transparent 60%);
//   pointer-events:none;
//   opacity:.9;
// }

// .authv2-top{
//   display:flex;
//   align-items:center;
//   justify-content:space-between;
//   gap:12px;
//   position: relative;
//   z-index: 1;
// }

// .authv2-chips{
//   display:flex;
//   gap:8px;
//   flex-wrap:wrap;
//   justify-content:flex-end;
// }

// .chip{
//   font-size:12px;
//   font-weight:900;
//   color: rgba(231,233,234,.85);
//   border:1px solid rgba(255,255,255,.10);
//   background: rgba(0,0,0,.22);
//   padding:8px 10px;
//   border-radius:999px;
// }

// .authv2-hero2{
//   margin-top:26px;
//   font-size:44px;
//   line-height:1.02;
//   font-weight:950;
//   letter-spacing:-1.2px;
//   position: relative;
//   z-index: 1;
// }

// .authv2-hero2 .hi{
//   background: linear-gradient(90deg, #fff, rgba(231,233,234,.58));
//   -webkit-background-clip:text;
//   background-clip:text;
//   color:transparent;
// }

// .authv2-hero2 .underline{
//   position:absolute;
//   left:0;
//   bottom:-10px;
//   width: 220px;
//   height: 6px;
//   border-radius: 999px;
//   background: linear-gradient(90deg, rgba(29,155,240,.9), rgba(249,24,128,.35), transparent);
//   opacity:.65;
//   filter: blur(.2px);
// }

// .authv2-sub2{
//   margin-top:20px;
//   max-width: 430px;
//   color: rgba(231,233,234,.70);
//   font-size:14px;
//   line-height:1.6;
//   position: relative;
//   z-index: 1;
// }

// .authv2-bullets{
//   margin-top:18px;
//   display:grid;
//   gap:12px;
//   max-width: 460px;
//   position: relative;
//   z-index: 1;
// }

// .authv2-bullets .b{
//   display:flex;
//   gap:12px;
//   align-items:flex-start;
//   padding:12px 12px;
//   border:1px solid rgba(255,255,255,.08);
//   background: rgba(0,0,0,.18);
//   border-radius: 16px;
// }

// .fa-dot{
//   width:26px;
//   height:26px;
//   border-radius:999px;
//   display:grid;
//   place-items:center;
//   font-size:12px;
//   color:#000;
//   flex-shrink:0;
// }

// .fa-dot.blue{
//   background:#1d9bf0;
//   box-shadow:0 0 0 6px rgba(29,155,240,.15);
// }
// .fa-dot.pink{
//   background:#f91880;
//   box-shadow:0 0 0 6px rgba(249,24,128,.15);
// }
// .fa-dot.green{
//   background:#00ba7c;
//   box-shadow:0 0 0 6px rgba(0,186,124,.15);
// }


// .b-title{ font-weight:950; font-size:13px; }
// .b-desc{ color: rgba(231,233,234,.62); font-size:12px; margin-top:2px; }

// /* layered preview */
// .authv2-layer{
//   margin-top:18px;
//   position: relative;
//   height: 210px;
//   max-width: 520px;
//   z-index: 1;
// }

// .cardA,.cardB{
//   position:absolute;
//   inset:auto auto 0 0;
//   width: 520px;
//   max-width: 100%;
//   border-radius: 20px;
//   border:1px solid rgba(255,255,255,.10);
//   background: rgba(0,0,0,.22);
//   box-shadow: 0 20px 80px rgba(0,0,0,.45);
//   padding:16px;
// }

// .cardA{ transform: translateY(0); }
// .cardB{
//   width: 460px;
//   transform: translate(22px, 22px);
//   opacity:.7;
//   filter: blur(.2px);
// }

// .cardA .row, .cardB .row{ display:flex; align-items:center; gap:10px; }
// .ava{ width:36px; height:36px; border-radius:999px; background: rgba(255,255,255,.10); }
// .ava.sm{ width:30px; height:30px; opacity:.9; }
// .l{ height:10px; border-radius:999px; background: rgba(255,255,255,.10); flex:1; }
// .l.sm{ height:9px; opacity:.85; }
// .big{ height:64px; border-radius:14px; background: rgba(255,255,255,.06); margin-top:12px; }
// .big.sm{ height:54px; opacity:.85; }
// .mini{ display:flex; gap:10px; margin-top:12px; }
// .mini span{
//   height:10px; border-radius:999px; background: rgba(255,255,255,.08);
//   flex:1;
// }
// .mini span:nth-child(1){ flex:1.2; }
// .mini span:nth-child(2){ flex:0.9; }
// .mini span:nth-child(3){ flex:1.1; }

// .shine{
//   position:absolute;
//   left:-80px; top:-80px;
//   width: 180px; height: 180px;
//   background: radial-gradient(circle at 30% 30%, rgba(29,155,240,.28), transparent 60%);
//   filter: blur(2px);
//   opacity:.9;
//   pointer-events:none;
// }

// .authv2-footnote{
//   margin-top:14px;
//   font-size:12px;
//   color: rgba(231,233,234,.70);
//   position: relative;
//   z-index: 1;
// }
// .authv2-footnote .muted{ color: rgba(231,233,234,.50); margin-right:6px; }

// `;