import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";
const API = "/api";
const GOOGLE_REASON_TEXT = {
    unregistered_origin: "Origin hien tai chua duoc allow trong Google OAuth Client.",
    invalid_client: "Google Client ID khong hop le hoac da bi disable.",
    missing_client_id: "Server chua tra Google Client ID.",
    secure_http_required: "Google yeu cau HTTPS (localhost co the dung HTTP).",
    browser_not_supported: "Trinh duyet hien tai khong ho tro Google Sign-In.",
};

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
const normalizeClientId = (value) => (typeof value === "string" ? value.trim() : "");
const mapGoogleReasonToMessage = (reason) => {
    if (!reason) return "Khong mo duoc Google prompt. Thu lai sau.";
    return GOOGLE_REASON_TEXT[reason] || `Google prompt bi chan: ${reason}`;
};

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
    const googleInitRef = useRef(false);
    const googleClientIdRef = useRef("");
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleDebug, setGoogleDebug] = useState(() => ({
        stage: "idle",
        origin: window.location.origin,
        clientId: "",
        sdkReady: false,
        promptCalled: false,
        callbackReceived: false,
        tokenLength: 0,
        lastError: "",
        lastServerStatus: "",
        serverClientId: "",
        serverOrigin: "",
        serverOriginAllowed: null,
        configuredOrigins: [],
    }));

    const pushGoogleDebug = (patch) => {
        setGoogleDebug((prev) => {
            const next = { ...prev, ...patch };
            console.log("[GOOGLE_DEBUG]", next);
            return next;
        });
    };

    const readGoogleServerDebug = async () => {
        try {
            const res = await fetch(`${API}/auth/google-debug`, { cache: "no-store" });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data) return;

            pushGoogleDebug({
                serverClientId: normalizeClientId(data.clientId),
                serverOrigin: data.origin || "",
                serverOriginAllowed: typeof data.originAllowed === "boolean" ? data.originAllowed : null,
                configuredOrigins: Array.isArray(data.configuredOrigins) ? data.configuredOrigins : [],
            });
        } catch {
            // Ignore debug endpoint errors.
        }
    };

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

    const loadGoogleScript = () =>
        new Promise((resolve, reject) => {
            if (window.google?.accounts?.id) {
                pushGoogleDebug({ stage: "sdk_already_loaded", sdkReady: true });
                resolve();
                return;
            }

            const src = "https://accounts.google.com/gsi/client";
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                pushGoogleDebug({ stage: "sdk_tag_exists_waiting" });
                existing.addEventListener("load", () => {
                    pushGoogleDebug({ stage: "sdk_loaded", sdkReady: true });
                    resolve();
                }, { once: true });
                existing.addEventListener("error", () => {
                    pushGoogleDebug({ stage: "sdk_load_failed", lastError: "Failed to load Google SDK (existing script)" });
                    reject(new Error("Load Google script failed"));
                }, { once: true });
                return;
            }

            pushGoogleDebug({ stage: "sdk_injecting_script" });
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                pushGoogleDebug({ stage: "sdk_loaded", sdkReady: true });
                resolve();
            };
            script.onerror = () => {
                pushGoogleDebug({ stage: "sdk_load_failed", lastError: "Failed to load Google SDK (new script)" });
                reject(new Error("Load Google script failed"));
            };
            document.head.appendChild(script);
        });

    const loginWithGoogleToken = async (idToken) => {
        pushGoogleDebug({
            stage: "credential_received",
            callbackReceived: true,
            tokenLength: idToken?.length || 0,
        });

        if (!idToken) {
            setServerError("Google token khong hop le");
            pushGoogleDebug({ stage: "credential_invalid", lastError: "Empty credential from Google callback" });
            return;
        }

        setServerError("");

        try {
            setLoading(true);
            const res = await fetch(`${API}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });
            pushGoogleDebug({ stage: "server_google_called", lastServerStatus: `HTTP ${res.status}` });

            let data = null;
            let text = "";
            try {
                data = await res.json();
            } catch {
                text = await res.text().catch(() => "");
            }

            if (!res.ok) {
                const msg = data?.message || text || "Google login that bai";
                setServerError(msg);
                pushGoogleDebug({ stage: "server_google_failed", lastError: msg });
                return;
            }

            if (!data?.token) {
                const msg = data?.message || "Google login that bai";
                setServerError(msg);
                pushGoogleDebug({ stage: "server_google_no_token", lastError: msg });
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("currentUser", JSON.stringify(data.user));
            setToast("Google login OK");
            pushGoogleDebug({ stage: "server_google_success", lastError: "" });
            navigate("/profile");
        } catch (err) {
            setServerError("Khong ket noi duoc server");
            pushGoogleDebug({
                stage: "server_google_exception",
                lastError: err instanceof Error ? err.message : "Cannot call /api/auth/google",
            });
        } finally {
            setLoading(false);
        }
    };

    const promptGoogleLogin = async () => {
        pushGoogleDebug({
            stage: "prompt_clicked",
            origin: window.location.origin,
            clientId: googleClientIdRef.current || "",
            sdkReady: !!window.google?.accounts?.id,
            promptCalled: true,
            callbackReceived: false,
            tokenLength: 0,
            lastError: "",
        });

        const ready = await initGoogleSignIn();
        if (!ready) {
            pushGoogleDebug({
                stage: "prompt_blocked_not_ready",
                lastError: "Google init failed before prompt",
            });
            return;
        }

        setTimeout(() => {
            pushGoogleDebug({ stage: "prompt_opening" });
            window.google.accounts.id.cancel?.();
            window.google.accounts.id.prompt((moment) => {
                let reason = "";

                if (moment?.isNotDisplayed?.()) {
                    reason = moment.getNotDisplayedReason?.() || "";
                    pushGoogleDebug({ stage: "prompt_not_displayed", lastError: reason || "unknown_not_displayed" });
                } else if (moment?.isSkippedMoment?.()) {
                    reason = moment.getSkippedReason?.() || "";
                    pushGoogleDebug({ stage: "prompt_skipped", lastError: reason || "unknown_skipped" });
                } else if (moment?.isDismissedMoment?.()) {
                    reason = moment.getDismissedReason?.() || "";
                    pushGoogleDebug({ stage: "prompt_dismissed", lastError: reason || "unknown_dismissed" });
                } else {
                    pushGoogleDebug({ stage: "prompt_displayed" });
                }

                if (reason) {
                    setServerError(mapGoogleReasonToMessage(reason));
                }
            });
        }, 0);
    };

    const initGoogleSignIn = async () => {
        if (googleInitRef.current && window.google?.accounts?.id) {
            pushGoogleDebug({
                stage: "already_initialized",
                sdkReady: true,
                clientId: googleClientIdRef.current || "",
            });
            return true;
        }

        try {
            setGoogleLoading(true);
            setServerError("");
            pushGoogleDebug({ stage: "init_started", origin: window.location.origin, lastError: "" });

            let clientId = googleClientIdRef.current;
            if (!clientId) {
                pushGoogleDebug({ stage: "fetching_client_id" });

                const cfgRes = await fetch(`${API}/auth/google-client-id`, { cache: "no-store" });
                const cfg = await cfgRes.json().catch(() => null);
                const resolvedClientId = normalizeClientId(cfg?.clientId);
                pushGoogleDebug({
                    stage: "client_id_response",
                    lastServerStatus: `HTTP ${cfgRes.status}`,
                    clientId: resolvedClientId,
                });

                if (!cfgRes.ok || !resolvedClientId) {
                    const msg = cfg?.message || "Server chua cau hinh Google login";
                    setServerError(msg);
                    pushGoogleDebug({ stage: "client_id_invalid", lastError: msg });
                    return false;
                }

                clientId = resolvedClientId;
                googleClientIdRef.current = clientId;
            }

            await loadGoogleScript();

            if (!window.google?.accounts?.id) {
                const msg = "Google Sign-In SDK chua san sang";
                setServerError(msg);
                pushGoogleDebug({ stage: "sdk_not_ready", sdkReady: false, lastError: msg });
                return false;
            }

            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: (response) => loginWithGoogleToken(response?.credential),
                use_fedcm_for_prompt: false,
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            googleInitRef.current = true;
            pushGoogleDebug({ stage: "initialized", sdkReady: true, clientId, lastError: "" });
            return true;
        } catch (err) {
            console.error(err);
            const msg = "Khong tai duoc Google SDK. Kiem tra internet va thu lai";
            setServerError(msg);
            pushGoogleDebug({ stage: "init_exception", lastError: err instanceof Error ? err.message : msg });
            return false;
        } finally {
            setGoogleLoading(false);
        }
    };





    useEffect(() => {
        readGoogleServerDebug();
    }, []);

    useEffect(() => {
        if (tab !== "login") return;
        if (googleInitRef.current) return;
        initGoogleSignIn();
    }, [tab]);

    return (
        <div className="authv2">
            <div className="authv2-shell">
                {/* LEFT */}
                <div className="authv2-left alt">
                    <div className="authv2-top">
                        <div className="authv2-badge">
                            <img
                                src="https://res.cloudinary.com/do48qpmut/image/upload/v1769763432/seh3vzxmptutookzzbjb.jpg"
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

                            <div className="copy-container">
                                <p className="authv2-desc">test@gmail.com</p>
                                <button className="copy-btn" onClick={() => navigator.clipboard.writeText('test@gmail.com')}>
                                    Copy
                                </button>
                            </div>

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

                                <div className="or-divider">
                                    <span>or</span>
                                </div>

                                <div className="google-login-wrap">
                                    <button
                                        type="button"
                                        className="google-custom-btn"
                                        onClick={promptGoogleLogin}
                                        disabled={loading || googleLoading}
                                    >
                                        <span className="google-custom-icon" aria-hidden="true">
                                            G
                                        </span>
                                        <span className="google-custom-text">
                                            {googleLoading ? "Loading Google..." : "Continue with Google"}
                                        </span>
                                    </button>
                                </div>

                                <details className="google-debug-box">
                                    <summary>Google Debug</summary>
                                    <pre>{JSON.stringify(googleDebug, null, 2)}</pre>
                                </details>


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
                            <p className="authv2-desc">Chỉ 1 phút là xong </p>

                            {success ? (
                                <div className="done">
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

