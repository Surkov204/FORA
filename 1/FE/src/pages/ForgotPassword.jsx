import { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./auth.css";

const API = "/api";
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const canSubmit = useMemo(() => {
    return isValidEmail(email) && !loading;
  }, [email, loading]);

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!canSubmit) {
      setToast("Nhập email hợp lệ trước đã 😄");
      return;
    }

    try {
      setLoading(true);

      // endpoint gợi ý: /auth/forgot-password
      // Nếu backend bạn khác, đổi URL cho khớp.
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      let data = null;
      let text = "";
      try {
        data = await res.json();
      } catch {
        text = await res.text().catch(() => "");
      }

      if (!res.ok) {
        setServerError(data?.message || text || "Gửi yêu cầu thất bại");
        return;
      }

      setDone(true);
      setToast("Sent ✅ Check email");
    } catch {
      setServerError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!isValidEmail(email)) return;
    setServerError("");

    try {
      setLoading(true);
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setServerError(data?.message || "Gửi lại thất bại");
        return;
      }

      setToast("Resent ✅");
    } catch {
      setServerError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authv2">
      <div className="authv2-shell authv2-onecol">
        {/* LEFT (mini) */}
        <div className="authv2-left alt authv2-left-mini">
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
                <i className="fa-solid fa-lock" /> Secure
              </span>
              <span className="chip">
                <i className="fa-solid fa-bolt" /> Fast
              </span>
            </div>
          </div>

          <div className="authv2-hero2">
            Reset your <span className="hi">password</span>
            <span className="underline" />
          </div>

          <div className="authv2-sub2">
            Nhập email để nhận link đặt lại mật khẩu. Nếu không thấy, kiểm tra Spam/Promotions.
          </div>

          <div className="authv2-footnote">
            <span className="muted">Remembered it?</span> Back to login anytime.
          </div>
        </div>

        {/* RIGHT */}
        <div className="authv2-right">
          <div className="crumb2">
            <button type="button" className="crumbBtn" onClick={() => navigate(-1)} disabled={loading}>
              ← Back
            </button>
            <span className="crumbSep">/</span>
            <Link className="crumbLink" to="/login">
              Login
            </Link>
          </div>

          {serverError ? (
            <div className="authv2-alert">
              <b>Lỗi:</b> {serverError}
            </div>
          ) : null}

          <div className="panel panel-static">
            <h1 className="authv2-title">Forgot password</h1>
            <p className="authv2-desc">We’ll send you a reset link (nếu email tồn tại).</p>

            {done ? (
              <div className="done">
                <div className="done-title">Sent ✅</div>
                <div className="done-text">
                  Nếu <b>{email.trim()}</b> tồn tại trong hệ thống, bạn sẽ nhận được email reset trong vài phút.
                </div>

                <div className="row3">
                  <button className="ghost2" type="button" onClick={resend} disabled={loading}>
                    {loading ? "Sending..." : "Resend email"}
                  </button>

                  <Link className="primary2 linkAsBtn" to="/login">
                    Back to Login <span style={{ opacity: 0.8 }}>→</span>
                  </Link>
                </div>

                <div className="helper2">
                  Tip: kiểm tra <b>Spam</b>/<b>Promotions</b> hoặc search “reset password”.
                </div>
              </div>
            ) : (
              <form className="authv2-form" onSubmit={submit}>
                <div className="f2">
                  <label>Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="email@domain.com"
                  />
                  <div className={`hint2 ${isValidEmail(email) ? "ok" : ""}`}>
                    {email ? (isValidEmail(email) ? "Email hợp lệ" : "Email chưa đúng") : "VD: email@domain.com"}
                  </div>
                </div>

                <button className="primary2" disabled={!canSubmit} type="submit">
                  {loading ? "Sending..." : "Send reset link"}
                  <span style={{ opacity: 0.8 }}>{loading ? "⏳" : "→"}</span>
                </button>

                <div className="below2">
                  <span className="muted2">Chưa có tài khoản?</span>
                  <Link className="link2" to="/auth">
                    Create one
                  </Link>
                </div>
              </form>
            )}
          </div>

          {toast ? <div className="toast2">{toast}</div> : null}
        </div>
      </div>
    </div>
  );
}
