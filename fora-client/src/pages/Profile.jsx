import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./profile.css";
import PostCard from "../Components/PostCard";

const API = "/api"; // dùng proxy vite -> backend 5106

function decodeJwt(token) {
    try {
        const payload = token.split(".")[1];
        return JSON.parse(atob(payload));
    } catch {
        return null;
    }
}

function getUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const decoded = decodeJwt(token);
    if (!decoded) return null;

    return {
        userId: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"],
        email: decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"],
        role: decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"],
    };
}

function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString();
}

// render text an toàn + giữ xuống dòng (React sẽ escape tự động)
function TextWithBreaks({ text }) {
    if (!text) return null;
    return text.split("\n").map((line, i) => (
        <span key={i}>
            {line}
            <br />
        </span>
    ));
}

export default function Profile() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const token = useMemo(() => localStorage.getItem("token"), []);
    const userFromToken = useMemo(() => getUserFromToken(), []);

    // Nếu chưa login -> đá về login
    useEffect(() => {
        if (!token || !userFromToken?.userId) navigate("/login");
    }, [token, userFromToken, navigate]);

    const userId = userFromToken?.userId;

    // ===== state =====
    const [profile, setProfile] = useState(() => {
        // render nhanh từ localStorage cho “mượt” như bạn làm renderLocalUser()
        const cached = localStorage.getItem("currentUser");
        if (!cached) return null;
        try {
            const u = JSON.parse(cached);
            return {
                displayName: u.displayName || u.fullName || "User",
                bio: u.bio || "",
                avatarUrl:
                    u.avatarUrl ||
                    "https://i.pinimg.com/736x/01/6c/6f/016c6fd3571087621dc810ecfad542a9.jpg",
                postCount: u.postCount || 0,
            };
        } catch {
            return null;
        }
    });

    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({ displayName: "", bio: "", avatarUrl: "" });

    const [posts, setPosts] = useState([]);
    const [postContent, setPostContent] = useState("");
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPosts, setLoadingPosts] = useState(false);

    const [openComments, setOpenComments] = useState(() => ({})); // {postId: true/false}
    const [commentsByPost, setCommentsByPost] = useState(() => ({})); // {postId: comments[]}
    const [commentInputByPost, setCommentInputByPost] = useState(() => ({})); // {postId: "text"}


    // ===== load profile =====
    const loadProfile = async () => {
        if (!userId) return;
        try {
            setLoadingProfile(true);
            const res = await fetch(`${API}/profile/${userId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) return;

            const data = await res.json();
            setProfile(data);

            setEditForm({
                displayName: data.displayName || "",
                bio: data.bio || "",
                avatarUrl: data.avatarUrl || "",
            });

            // update cache giống bạn
            const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
            currentUser.displayName = data.displayName;
            currentUser.bio = data.bio;
            currentUser.avatarUrl = data.avatarUrl;
            currentUser.postCount = data.postCount;
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
        } finally {
            setLoadingProfile(false);
        }
    };

    // ===== load posts =====
    const loadPosts = async () => {
        if (!userId || !token) return;
        try {
            setLoadingPosts(true);
            const res = await fetch(`${API}/profile/${userId}/posts`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return;

            const data = await res.json();
            setPosts(Array.isArray(data) ? data : []);
        } finally {
            setLoadingPosts(false);
        }
    };

    useEffect(() => {
        // gọi 1 lần khi vào page
        loadProfile();
        loadPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // ===== update profile =====
    const updateProfile = async () => {
        if (!userId || !token) return;

        await fetch(`${API}/profile/${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(editForm),
        });

        // cache lại giống bạn
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        currentUser.displayName = editForm.displayName;
        currentUser.bio = editForm.bio;
        currentUser.avatarUrl = editForm.avatarUrl;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));

        setEditOpen(false);
        await loadProfile();
        await loadPosts();
    };

    // ===== avatar upload =====
    const handleAvatarSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !userId || !token) return;

        // preview ngay
        const preview = URL.createObjectURL(file);
        setProfile((p) => (p ? { ...p, avatarUrl: preview } : p));

        const formData = new FormData();
        formData.append("avatar", file);

        const res = await fetch(`${API}/profile/${userId}/avatar`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });

        if (!res.ok) {
            alert("Upload avatar failed");
            return;
        }

        const data = await res.json();
        const avatarUrl = data.avatarUrl;

        setProfile((p) => (p ? { ...p, avatarUrl } : p));

        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        currentUser.avatarUrl = avatarUrl;
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
    };

    // ===== create post =====
    const createPost = async () => {
        const content = postContent.trim();
        if (!content || !token) return;

        const res = await fetch(`${API}/posts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ content }),
        });

        if (!res.ok) {
            console.error("Create post failed", await res.text());
            return;
        }

        setPostContent("");
        await loadPosts();
    };

    // ===== like (giữ logic giống cũ, nhưng React update state) =====
    const toggleLike = async (postId) => {
        if (!token) return;

        const res = await fetch(`${API}/likes/${postId}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const data = await res.json();
        setPosts((prev) =>
            prev.map((p) =>
                p.id === postId
                    ? { ...p, likeCount: data.likeCount, isLiked: data.isLiked }
                    : p
            )
        );
    };

    // ===== COMMENTS =====
    const toggleComments = async (postId) => {
        setOpenComments((prev) => {
            const nextOpen = !prev[postId];
            return { ...prev, [postId]: nextOpen };
        });

        // nếu đang mở thì load comments
        const isOpening = !openComments[postId];
        if (isOpening) {
            await loadComments(postId);
        }
    };

    const loadComments = async (postId) => {
        try {
            const res = await fetch(`${API}/comments/post/${postId}`, {
                // nếu API comments không cần token thì để {} cũng được
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (!res.ok) throw new Error("Load comment failed");

            const comments = await res.json();
            setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
        } catch (e) {
            console.error(e);
            setCommentsByPost((prev) => ({ ...prev, [postId]: [] }));
        }
    };

    const submitComment = async (postId) => {
        const content = (commentInputByPost[postId] || "").trim();
        if (!content) return;

        try {
            const res = await fetch(`${API}/comments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ postId, content }),
            });

            if (!res.ok) {
                alert("Comment failed!");
                return;
            }

            // clear input
            setCommentInputByPost((prev) => ({ ...prev, [postId]: "" }));

            // reload list
            await loadComments(postId);

            // tăng commentCount ngoài post
            setPosts((prev) =>
                prev.map((p) =>
                    p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
                )
            );
        } catch (e) {
            console.error(e);
            alert("Error sending comment");
        }
    };


    if (!profile) {
        return (
            <div style={{ padding: 20, color: "#fff" }}>
                {loadingProfile ? "Loading profile..." : "No profile"}
            </div>
        );
    }



    const avatar = profile.avatarUrl || "https://via.placeholder.com/120";

    return (
        <div className="app-layout">
            {/* ===== LEFT ===== */}
            <aside className="identity-col">
                <div className="dark-card profile-card">
                    <div className="cover-bg"></div>

                    <div className="profile-main">
                        <div className="avatar-wrapper">
                            <img id="avatar" src={avatar} alt="avatar" />
                            <div
                                className="avatar-overlay"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <i className="fa-solid fa-camera"></i>
                                <span>Change</span>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleAvatarSelect}
                            />
                        </div>

                        <h1 id="displayName">{profile.displayName || "User"}</h1>
                        <p className="handle">@{(profile.handle || "fora_user").replace("@", "")}</p>

                        <p id="bio" className="bio">
                            <TextWithBreaks text={profile.bio || ""} />
                        </p>

                        <div className="stats-row">
                            <div className="stat">
                                <b>{profile.postCount ?? 0}</b>
                                <span>Post</span>
                            </div>
                            <div className="stat">
                                <b>{profile.followerCount ?? "—"}</b>
                                <span>Followers</span>
                            </div>
                            <div className="stat">
                                <b>{profile.followingCount ?? "—"}</b>
                                <span>Following</span>
                            </div>
                        </div>

                        <div className="action-buttons">
                            <button className="btn-primary" onClick={() => setEditOpen((v) => !v)}>
                                <i className="fa-solid fa-pen"></i> Edit
                            </button>
                            <button className="btn-secondary">
                                <i className="fa-regular fa-envelope"></i> Message
                            </button>
                        </div>
                    </div>

                    <div className={`edit-drawer ${editOpen ? "" : "hidden"}`} id="editBox">
                        <div className="drawer-header">UPDATE INFO</div>

                        <input
                            placeholder="Name"
                            value={editForm.displayName}
                            onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                        />
                        <input
                            placeholder="Bio"
                            value={editForm.bio}
                            onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                        />
                        <input
                            placeholder="Avatar URL"
                            value={editForm.avatarUrl}
                            onChange={(e) => setEditForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                        />

                        <button className="btn-save" onClick={updateProfile}>
                            Save Changes
                        </button>
                    </div>
                </div>

                <div className="dark-card menu-card">
                    <a className="menu-item active" href="#">
                        <i className="fa-solid fa-house"></i> Home
                    </a>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-bell"></i> Notifications
                    </a>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-bookmark"></i> Bookmarks
                    </a>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-image"></i> Media
                    </a>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-gear"></i> Settings
                    </a>
                </div>
            </aside>

            {/* ===== RIGHT ===== */}
            <main className="content-col">
                <div className="dark-card composer-card">
                    <div className="composer-top">
                        <img src={avatar} className="avatar-tiny" alt="me" />
                        <textarea
                            id="postContent"
                            placeholder="What is happening?!"
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                        />
                    </div>

                    <div className="composer-actions">
                        <div className="action-icons">
                            <i className="fa-regular fa-image icon-btn"></i>
                            <i className="fa-solid fa-video icon-btn"></i>
                            <i className="fa-solid fa-face-smile icon-btn"></i>
                            <i className="fa-solid fa-calendar-days icon-btn"></i>
                        </div>

                        <button className="post-btn" onClick={createPost}>
                            Post
                        </button>
                    </div>
                </div>

                <div className="feed-filter">
                    <span className="active">Latest</span>
                    <span>Top</span>
                    <span>Media</span>
                </div>

                <div id="posts" className="feed-grid">
                    {loadingPosts ? (
                        <div style={{ padding: 16, color: "#71767b" }}>Loading posts...</div>
                    ) : posts.length === 0 ? (
                        <div style={{ padding: 16, color: "#71767b" }}>No posts yet.</div>
                    ) : (
                        posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                formatTime={formatTime}
                                onToggleComments={toggleComments}
                                onToggleLike={toggleLike}
                                commentsOpen={!!openComments[post.id]}
                                comments={commentsByPost[post.id] || []}
                                commentInputValue={commentInputByPost[post.id] || ""}
                                onCommentInputChange={(text) =>
                                    setCommentInputByPost((prev) => ({ ...prev, [post.id]: text }))
                                }
                                onSubmitComment={() => submitComment(post.id)}
                                currentUserAvatar={avatar}
                            />
                        ))
                    )}
                </div>

            </main>
        </div>
    );
}
