import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import "./auth.css";

const API = "/api";

/* utils */
const scorePassword = (pw) => {
  let s = 0;
  if (!pw) return 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const strengthLabel = (score) =>
  score <= 1 ? "Weak" : score === 2 ? "Okay" : score === 3 ? "Good" : "Strong";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const qEmail = (params.get("email") || "").trim();
  const qToken = (params.get("token") || "").trim();

  const [pw, setPw] = useState("");
  const [cf, setCf] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const pwScore = useMemo(() => scorePassword(pw), [pw]);

  const checks = useMemo(() => {
    const tokenOk = qToken.length > 10;
    const emailOk = qEmail.length > 3; // FE chỉ check nhẹ thôi, backend quyết
    const lenOk = pw.length >= 8;
    const matchOk = cf && cf === pw;
    return { tokenOk, emailOk, lenOk, matchOk };
  }, [qToken, qEmail, pw, cf]);

  const canSubmit = useMemo(() => {
    return checks.tokenOk && checks.emailOk && checks.lenOk && checks.matchOk && !loading;
  }, [checks, loading]);

  const submit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!canSubmit) {
      setToast("Nhập đúng & đủ trước đã 😄");
      return;
    }

    try {
      setLoading(true);

      // ✅ endpoint gợi ý (đổi theo backend m)
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: qEmail,
          token: qToken,
          newPassword: pw,
        }),
      });

      let data = null;
      let text = "";
      try {
        data = await res.json();
      } catch {
        text = await res.text().catch(() => "");
      }

      if (!res.ok) {
        setServerError(data?.message || text || "Reset thất bại");
        return;
      }

      setDone(true);
      setToast("Reset OK ✅");
    } catch {
      setServerError("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  };

  const missingQuery = !checks.emailOk || !checks.tokenOk;

  return (
    <div className="authv2">
      <div className="authv2-shell authv2-onecol">
        {/* LEFT */}
        <div className="authv2-left alt authv2-left-mini">
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
                <i className="fa-solid fa-lock" /> Secure
              </span>
              <span className="chip">
                <i className="fa-solid fa-bolt" /> Fast
              </span>
            </div>
          </div>

          <div className="authv2-hero2">
            Set a new <span className="hi">password</span>
            <span className="underline" />
          </div>

          <div className="authv2-sub2">
            Tạo mật khẩu mới cho tài khoản. Link reset chỉ có hiệu lực trong thời gian giới hạn.
          </div>

          <div className="authv2-footnote">
            <span className="muted">Tip:</span> dùng tối thiểu 8 ký tự + số để an toàn hơn.
          </div>
        </div>

        {/* RIGHT */}
        <div className="authv2-right">
          <div className="crumb2">
            <Link className="crumbLink" to="/login">
              Login
            </Link>
            <span className="crumbSep">/</span>
            <span style={{ opacity: 0.7 }}>Reset</span>
          </div>

          {serverError ? (
            <div className="authv2-alert">
              <b>Lỗi:</b> {serverError}
            </div>
          ) : null}

          <div className="panel panel-static">
            <h1 className="authv2-title">Reset password</h1>
            <p className="authv2-desc">
              {qEmail ? (
                <>
                  For <b>{qEmail}</b>
                </>
              ) : (
                "Open link từ email để reset."
              )}
            </p>

            {missingQuery ? (
              <div className="done">
                <div className="done-title">Link không hợp lệ ⚠️</div>
                <div className="done-text">
                  Thiếu <b>email</b> hoặc <b>token</b>. Vui lòng mở đúng link trong email reset.
                </div>

                <div className="row3">
                  <Link className="primary2 linkAsBtn" to="/forgot-password">
                    Gửi lại reset link <span style={{ opacity: 0.8 }}>→</span>
                  </Link>
                  <button className="ghost2" type="button" onClick={() => navigate("/login")}>
                    Back to Login
                  </button>
                </div>
              </div>
            ) : done ? (
              <div className="done">
                <div className="done-title">Done ✅</div>
                <div className="done-text">
                  Mật khẩu đã được cập nhật. Giờ m có thể đăng nhập bằng mật khẩu mới.
                </div>

                <div className="row3">
                  <Link className="primary2 linkAsBtn" to="/login">
                    Go to Login <span style={{ opacity: 0.8 }}>→</span>
                  </Link>
                  <button className="ghost2" type="button" onClick={() => navigate("/")}>
                    Home
                  </button>
                </div>
              </div>
            ) : (
              <form className="authv2-form" onSubmit={submit}>
                <div className="f2">
                  <label>New password</label>
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

                  <div className={`hint2 ${checks.lenOk ? "ok" : ""}`}>
                    {pw ? (checks.lenOk ? "Độ dài OK" : "Tối thiểu 8 ký tự") : "Gợi ý: thêm số / ký tự đặc biệt"}
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

                <button className="primary2" disabled={!canSubmit} type="submit">
                  {loading ? "Updating..." : "Update password"}
                  <span style={{ opacity: 0.8 }}>{loading ? "⏳" : "→"}</span>
                </button>

                <div className="below2">
                  <span className="muted2">Nhớ mật khẩu rồi?</span>
                  <Link className="link2" to="/login">
                    Login
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
