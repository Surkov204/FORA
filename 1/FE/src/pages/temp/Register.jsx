import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./profile.css";     // dùng tokens/vars sẵn
import "./register.css";    // css riêng cho register

const API = "/api";

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function scorePassword(pw) {
  // score 0-4 đơn giản
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function strengthLabel(score) {
  if (score <= 1) return "Weak";
  if (score === 2) return "Okay";
  if (score === 3) return "Good";
  return "Strong";
}

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [agree, setAgree] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(null); // { message, email }

  const pwScore = useMemo(() => scorePassword(pw), [pw]);

  const checks = useMemo(() => {
    const emailOk = isValidEmail(email);
    const lenOk = pw.length >= 8;
    const mixOk = /[A-Z]/.test(pw) && /[0-9]/.test(pw);
    const matchOk = cf && cf === pw;
    return { emailOk, lenOk, mixOk, matchOk };
  }, [email, pw, cf]);

  const canSubmit = useMemo(() => {
    return (
      checks.emailOk &&
      checks.lenOk &&
      checks.matchOk &&
      agree &&
      !loading
    );
  }, [checks, agree, loading]);

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!canSubmit) {
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
        message:
          data?.message ||
          "Đăng ký thành công. Vui lòng kiểm tra email để xác thực.",
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
    } catch {
      setServerError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true" />

      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-logo">F</div>
          <div className="auth-brand-text">
            <div className="auth-name">Fora</div>
            <div className="auth-tag">Create account to start posting</div>
          </div>
        </div>

        <div className="auth-card">
          {success ? (
            <div className="auth-done">
              <div className="auth-done-title">Registered ✅</div>
              <div className="auth-done-text">{success.message}</div>

              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-btn auth-btn--ghost"
                  onClick={resend}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Resend verification email"}
                </button>

                <button
                  className="auth-btn auth-btn--primary"
                  type="button"
                  onClick={() => navigate("/login")}
                >
                  Back to Login <span className="auth-btn-icon">→</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="auth-head">
                <h1>Create your account</h1>
                <p>Welcome. Let’s set you up 😄</p>
              </div>

              {serverError ? (
                <div className="auth-alert">
                  <b>Lỗi:</b> {serverError}
                </div>
              ) : null}

              <form onSubmit={submit} className="auth-form">
                {/* Email */}
                <div className={`fl ${email ? "has" : ""}`}>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder=" "
                  />
                  <label>Email</label>
                  <div className={`hint ${checks.emailOk ? "ok" : ""}`}>
                    {checks.emailOk ? "Email hợp lệ" : "VD: email@domain.com"}
                  </div>
                </div>

                {/* Password */}
                <div className={`fl ${pw ? "has" : ""}`}>
                  <div className="pwline">
                    <input
                      type={showPw ? "text" : "password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      autoComplete="new-password"
                      placeholder=" "
                    />
                    <button
                      type="button"
                      className="pwbtn"
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>

                  <label>Password</label>

                  <div className="meter">
                    <div className="meter-track">
                      <div
                        className={`meter-fill s${pwScore}`}
                        style={{ width: `${(pwScore / 4) * 100}%` }}
                      />
                    </div>
                    <span className="meter-text">
                      {pw ? strengthLabel(pwScore) : "—"}
                    </span>
                  </div>

                  <ul className="checklist">
                    <li className={checks.lenOk ? "ok" : ""}>≥ 8 ký tự</li>
                    <li className={checks.mixOk ? "ok" : ""}>Có chữ hoa & số</li>
                  </ul>
                </div>

                {/* Confirm */}
                <div className={`fl ${cf ? "has" : ""}`}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={cf}
                    onChange={(e) => setCf(e.target.value)}
                    autoComplete="new-password"
                    placeholder=" "
                  />
                  <label>Confirm password</label>
                  <div className={`hint ${checks.matchOk ? "ok" : ""}`}>
                    {checks.matchOk ? "Khớp mật khẩu" : "Nhập lại cho đúng"}
                  </div>
                </div>

                <label className="agree">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  <span>
                    Mình đồng ý với <b>Terms</b> & <b>Privacy</b>
                  </span>
                </label>

                <button
                  className="auth-btn auth-btn--primary"
                  disabled={!canSubmit}
                  type="submit"
                >
                  {loading ? "Creating..." : "Create account"}
                  <span className="auth-btn-icon">{loading ? "⏳" : "→"}</span>
                </button>

                <div className="split"><span>or</span></div>

                <button
                  type="button"
                  className="auth-btn auth-btn--ghost"
                  onClick={() => setServerError("Google signup: wire sau nhé bro 😄")}
                >
                  Continue with Google
                </button>

                <div className="foot">
                  <span>Đã có tài khoản?</span>
                  <button type="button" className="link" onClick={() => navigate("/login")}>
                    Login
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
