function handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    // preview ngay
    const reader = new FileReader();
    reader.onload = () => {
        document.getElementById("avatar").src = reader.result;
        document.getElementById("avatar-mini").src = reader.result;
    };
    reader.readAsDataURL(file);

    // upload lên server
    uploadAvatar(file);
}

async function uploadAvatar(file) {
    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${API}/api/profile/${userId}/avatar`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData
    });

    if (!res.ok) {
        alert("Upload avatar failed");
        return;
    }

    const data = await res.json();

    // server trả về URL ảnh
    document.getElementById("avatar").src = data.avatarUrl;
    document.getElementById("avatar-mini").src = data.avatarUrl;
    // Cập nhật avatar mới vào cache
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    currentUser.avatarUrl = data.avatarUrl;
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
}



function getUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payload = token.split(".")[1];
        const decoded = JSON.parse(atob(payload));

        return {
            userId: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
            email: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
            role: decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
        };
    } catch (e) {
        console.error("Invalid token", e);
        return null;
    }
}



// Hàm mới: Hiển thị user từ localStorage (Nhanh tức thì)
function renderLocalUser() {
    const userJson = localStorage.getItem("currentUser");
    if (!userJson) return;

    const user = JSON.parse(userJson);

    // Cập nhật giao diện ngay lập tức
    const nameEl = document.getElementById("displayName");
    const bioEl = document.getElementById("bio");
    const avatarEl = document.getElementById("avatar");
    const avatarMiniEl = document.getElementById("avatar-mini");

    if (nameEl) nameEl.innerText = user.displayName;
    // Bio có thể chưa có trong login response rút gọn, nên check kỹ
    if (bioEl && user.bio) bioEl.innerHTML = user.bio.replace(/\n/g, "<br>"); 
    if (avatarEl) avatarEl.src = user.avatarUrl;
    if (avatarMiniEl) avatarMiniEl.src = user.avatarUrl;
}

/* ================= CONFIG ================= */
const API = "http://localhost:5106";
const user = getUserFromToken();

if (!user) {
    window.location.href = "login.html";
}

const userId = user.userId;
/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadPosts();
});



/* ================= PROFILE ================= */

async function loadProfile() {
    const res = await fetch(`${API}/api/profile/${userId}`);
    if (!res.ok) return;

    const profile = await res.json();

    // Main profile
    document.getElementById("displayName").innerText = profile.displayName;
    document.getElementById("bio").innerHTML = (profile.bio || "").replace(/\n/g, "<br>");
    document.getElementById("avatar").src = profile.avatarUrl;
    document.getElementById("avatar-mini").src = profile.avatarUrl;

    // Edit drawer
    document.getElementById("nameInput").value = profile.displayName;
    document.getElementById("bioInput").value = profile.bio || "";
    document.getElementById("avatarInput").value = profile.avatarUrl;

    // Stats (hiện tại mới có postCount)
    const statPost = document.querySelector(".stat b");
    if (statPost) statPost.innerText = profile.postCount;
}

function toggleEdit() {
    document.getElementById("editBox").classList.toggle("hidden");
}

async function updateProfile() {
    const token = localStorage.getItem("token");

    await fetch(`${API}/api/profile/${userId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            displayName: document.getElementById("nameInput").value,
            bio: document.getElementById("bioInput").value,
            avatarUrl: document.getElementById("avatarInput").value
        })
    });
    // Cập nhật lại localStorage để lần sau vào nó hiện cái mới
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    currentUser.displayName = document.getElementById("nameInput").value;
    currentUser.bio = document.getElementById("bioInput").value;
    currentUser.avatarUrl = document.getElementById("avatarInput").value;
    
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    toggleEdit();
    loadProfile();
    loadPosts();
}

/* ================= POSTS ================= */

async function createPost() {
    const textarea = document.getElementById("postContent");
    const content = textarea.value.trim();
    if (!content) return;

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Bạn chưa đăng nhập");
        return;
    }

    const res = await fetch(`${API}/api/posts`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            content: content
        })
    });

    if (!res.ok) {
        console.error("Create post failed", await res.text());
        return;
    }

    textarea.value = "";
    loadPosts();
}

async function toggleLike(postId) {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/api/likes/${postId}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error("Lỗi API Like:", res.status);
        return;
    }

    const data = await res.json();

    // 1. Tìm thẻ bài viết
    const postEl = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postEl) return;

    // 2. Tìm các thành phần bên trong
    const likeBtn = postEl.querySelector(".act-btn.heart"); // Tìm button
    const heartIcon = likeBtn.querySelector("i");           // Tìm icon bên trong button
    const likeSpan = likeBtn.querySelector(".like-count");  // Tìm số like

    // 3. Cập nhật số lượng
    likeSpan.innerText = data.likeCount;

    // 4. Cập nhật giao diện (Quan trọng)
    if (data.isLiked) {
        // Nếu đã like: Thêm class 'liked' vào BUTTON để kích hoạt màu hồng
        likeBtn.classList.add("liked"); 
        
        // Đổi icon từ rỗng sang đặc
        heartIcon.classList.remove("fa-regular");
        heartIcon.classList.add("fa-solid");
        // (Không cần thêm class 'liked' vào icon nữa vì button cha đã lo màu sắc rồi)
    } else {
        // Nếu bỏ like: Xóa class 'liked' khỏi BUTTON
        likeBtn.classList.remove("liked");

        // Đổi icon từ đặc về rỗng
        heartIcon.classList.remove("fa-solid");
        heartIcon.classList.add("fa-regular");
    }
}


async function loadPosts() {
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch(`${API}/api/profile/${userId}/posts`, {
        headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) return;

    const posts = await res.json();
    const container = document.getElementById("posts");
    container.innerHTML = "";
    
    // Lấy avatar của người đang đăng nhập để hiện ở ô nhập liệu
    const myAvatarUrl = document.getElementById("avatar").src;

    posts.forEach(post => {
        // Logic nút Like
        const iconClass = post.isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart";
        const btnClass = post.isLiked ? "act-btn heart liked" : "act-btn heart";

        const div = document.createElement("div");
        div.className = "post-card";
        div.dataset.postId = post.id;

        // Render HTML bài viết + Khung Comment
        div.innerHTML = `
            <div class="p-header">
                <img class="avatar-tiny" src="${post.userAvatar || 'https://via.placeholder.com/40'}">
                <div class="p-info">
                    <span class="p-name">${escapeHtml(post.userDisplayName || 'User')}</span>
                    <span class="p-time">· ${formatTime(post.createdAt)}</span>
                </div>
            </div>

            <div class="p-content">${escapeHtml(post.content)}</div>

            <div class="p-actions">
                <button class="act-btn comment" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i>
                    <span id="c-count-${post.id}">${post.commentCount || 0}</span>
                </button>

                <button class="act-btn share">
                    <i class="fa-solid fa-retweet"></i>
                    <span>0</span>
                </button>

                <button class="${btnClass}" onclick="toggleLike('${post.id}')">
                    <i class="${iconClass}"></i>
                    <span class="like-count">${post.likeCount}</span>
                </button>

                <button class="act-btn">
                    <i class="fa-solid fa-share-nodes"></i>
                </button>
            </div>

            <div id="comment-box-${post.id}" class="comment-section">
                <div id="c-list-${post.id}" class="comment-list">
                    <div style="text-align:center; color:#777; font-size:0.8rem">Loading...</div>
                </div>

                <div class="comment-input-wrapper">
                    <img src="${myAvatarUrl}" class="c-avatar">
                    <input type="text" id="c-input-${post.id}" class="c-input" placeholder="Post your reply...">
                    <button class="c-send-btn" onclick="submitComment(${post.id})">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(div);
    });
}



/* ================= COMMENTS LOGIC ================= */

/* ================= COMMENT LOGIC ================= */

// 1. Hàm bật/tắt khung comment
async function toggleComments(postId) {
    const box = document.getElementById(`comment-box-${postId}`);
    
    // Toggle class 'open' để hiện/ẩn
    if (box.classList.contains("open")) {
        box.classList.remove("open");
    } else {
        box.classList.add("open");
        // Khi mở ra thì gọi API lấy danh sách comment
        await loadComments(postId);
    }
}

// 2. Hàm gọi API lấy danh sách comment
async function loadComments(postId) {
    const listDiv = document.getElementById(`c-list-${postId}`);
    
    try {
        const res = await fetch(`${API}/api/comments/post/${postId}`);
        if (!res.ok) throw new Error("Load comment failed");
        
        const comments = await res.json();
        
        if (comments.length === 0) {
            listDiv.innerHTML = `<div style="text-align:center; color:#555; padding:10px;">No comments yet.</div>`;
            return;
        }

        // Vẽ HTML danh sách comment
        listDiv.innerHTML = comments.map(c => `
            <div class="c-item">
                <img src="${c.userAvatarUrl || 'https://via.placeholder.com/32'}" class="c-avatar">
                <div class="c-content-box">
                    <div>
                        <span class="c-name">${escapeHtml(c.userDisplayName)}</span>
                        <span class="c-time">${formatTime(c.createdAt)}</span>
                    </div>
                    <span class="c-text">${escapeHtml(c.content)}</span>
                </div>
            </div>
        `).join("");

    } catch (e) {
        console.error(e);
        listDiv.innerHTML = `<div style="color:red; text-align:center">Error loading comments</div>`;
    }
}

// 3. Hàm gửi comment lên Server
async function submitComment(postId) {
    const input = document.getElementById(`c-input-${postId}`);
    const content = input.value.trim();
    
    if (!content) return;

    const token = localStorage.getItem("token");
    
    // Disable ô nhập để tránh bấm nhiều lần
    input.disabled = true;

    try {
        const res = await fetch(`${API}/api/comments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                postId: postId,
                content: content
            })
        });

        if (!res.ok) {
            alert("Comment failed!");
            input.disabled = false;
            return;
        }

        // Thành công
        input.value = "";
        input.disabled = false;
        
        // Tải lại danh sách comment để hiện cái mới nhất
        await loadComments(postId);

        // Cập nhật số lượng comment ở nút bấm bên ngoài
        const countSpan = document.getElementById(`c-count-${postId}`);
        if(countSpan) {
            let currentCount = parseInt(countSpan.innerText) || 0;
            countSpan.innerText = currentCount + 1;
        }

    } catch (e) {
        console.error(e);
        alert("Error sending comment");
        input.disabled = false;
    }
}



async function likePost(postId) {
    const token = localStorage.getItem("token"); // token m nhận lúc login

    if (!token) {
        alert("Bạn chưa đăng nhập");
        return;
    }

    const res = await fetch(`${API}/api/likes/${postId}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        }
    });

    if (!res.ok) {
        console.error("Like failed", await res.text());
        return;
    }

    loadPosts();
}

/* ================= UTILS ================= */

function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString();
}

// tránh XSS khi render content
function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML.replace(/\n/g, "<br>");
}
