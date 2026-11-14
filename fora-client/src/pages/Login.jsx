import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";

const API = "/api";

export default function Login() {
  const navigate = useNavigate();

  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fieldError, setFieldError] = useState({ emailOrPhone: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [toast, setToast] = useState("");

  const canSubmit = useMemo(() => {
    return emailOrPhone.trim().length > 0 && password.trim().length >= 1 && !loading;
  }, [emailOrPhone, password, loading]);

  useEffect(() => {
    const next = { emailOrPhone: "", password: "" };
    if (emailOrPhone.trim().length === 0) next.emailOrPhone = "Nhập email hoặc số điện thoại";
    if (password.trim().length === 0) next.password = "Nhập mật khẩu";
    setFieldError(next);
  }, [emailOrPhone, password]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!canSubmit) {
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
          setToast("Email chưa verify. Đang chuyển qua xác thực...");
          navigate("/verify-email", { state: { email: emailOrPhone } });
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

  return (
    <div className="xlogin-page">
      {/* nền glow */}
      <div className="xlogin-glow" aria-hidden="true" />

      <form onSubmit={handleSubmit} className="xlogin-card">
        <div className="xlogin-head">
          <div className="xlogin-mark" aria-hidden="true" />
          <div>
            <div className="xlogin-title">Welcome back</div>
            <div className="xlogin-sub">Đăng nhập để vào Fora</div>
          </div>
        </div>

        {serverError ? (
          <div className="xlogin-alert">
            <b>Lỗi:</b> {serverError}
          </div>
        ) : null}

        <label className="xlogin-label">Email hoặc SĐT</label>
        <input
          className={`xlogin-input ${fieldError.emailOrPhone ? "is-error" : ""}`}
          placeholder="email@domain.com hoặc 0123..."
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          autoComplete="username"
        />
        <div className={`xlogin-help ${fieldError.emailOrPhone ? "" : "ghost"}`}>
          {fieldError.emailOrPhone || "."}
        </div>

        <label className="xlogin-label">Mật khẩu</label>
        <div className="xlogin-row">
          <input
            className={`xlogin-input xlogin-input--pw ${fieldError.password ? "is-error" : ""}`}
            type={showPw ? "text" : "password"}
            placeholder="••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            className="xlogin-ghostBtn"
            onClick={() => setShowPw((v) => !v)}
            aria-label="toggle password"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        <div className={`xlogin-help ${fieldError.password ? "" : "ghost"}`}>
          {fieldError.password || "."}
        </div>

        <button className="xlogin-primary" type="submit" disabled={!canSubmit}>
          {loading ? "Logging in..." : "Login"}
          <span className="xlogin-primaryIcon">{loading ? "⏳" : "→"}</span>
        </button>

        <div className="xlogin-footer">
          <button type="button" className="xlogin-link" onClick={() => navigate("/register")}>
            Chưa có tài khoản? Register
          </button>
          <button type="button" className="xlogin-link" onClick={() => navigate("/forgot-password")}>
            Quên mật khẩu?
          </button>
        </div>

        {toast ? <div className="xlogin-toast">{toast}</div> : null}
      </form>
    </div>
  );
}
