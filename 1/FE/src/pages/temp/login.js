const API = "http://localhost:5106";

async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
        alert("Login failed");
        return;
    }

    const data = await res.json();
    
    // === ĐOẠN MỚI CẦN SỬA ===
    localStorage.setItem("token", data.token);
    // Lưu luôn thông tin user để dùng ở trang Profile
    localStorage.setItem("currentUser", JSON.stringify(data.user)); 

    window.location.href = "profile.html"; // Chuyển trang
}
