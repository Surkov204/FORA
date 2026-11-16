import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./profile.css";
import PostCard from "../Components/PostCard";
import { useLivePolls } from "../hooks/useLivePolls";
import { session } from "../session";
import { Link } from "react-router-dom";

const API = "/api"; // dùng proxy vite -> backend 5106

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
    const postMediaInputRef = useRef(null);

    const [auth] = useState(session);
    const token = auth?.token;
    const userId = auth?.id;
    const pollLive = useLivePolls();

    useEffect(() => {
        if (!auth) navigate("/auth", { replace: true });
    }, [auth, navigate]);

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
    const [postMediaUrls, setPostMediaUrls] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingPosts, setLoadingPosts] = useState(false);

    const [deleteTargetId, setDeleteTargetId] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);


    useEffect(() => {
        if (avatarPreviewOpen) setAvatarMenuOpen(false);
    }, [avatarPreviewOpen]);

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

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("currentUser");
        navigate("/login");
    };

    const toggleAvatarMenu = () => {
        setAvatarMenuOpen((v) => !v);
    };

    const closeAvatarMenu = () => {
        setAvatarMenuOpen(false);
    };

    const handleViewAvatar = () => {
        setAvatarMenuOpen(false);
        setTimeout(() => setAvatarPreviewOpen(true), 0);
    };

    const handleChangeAvatar = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        // Gọi trực tiếp vào ref của input file
        fileInputRef.current?.click();

        // Đóng menu sau khi đã kích hoạt trình chọn file
        setAvatarMenuOpen(false);
        setAvatarPreviewOpen(false);
    };


    async function uploadToCloudinary(file) {
        const cloudName = "do48qpmut"; // ví dụ: "dinhcloud"
        const uploadPreset = "fora2v";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            {
                method: "POST",
                body: formData,
            }
        );

        if (!res.ok) throw new Error("Upload Cloudinary Failed!");

        return await res.json(); // có secure_url
    }




    // ===== avatar upload =====
    const handleAvatarSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !userId || !token) return;

        // ✅ Preview ngay
        const preview = URL.createObjectURL(file);
        setProfile((p) => (p ? { ...p, avatarUrl: preview } : p));

        try {
            // ✅ Upload lên Cloudinary
            const uploadData = await uploadToCloudinary(file);
            const avatarUrl = uploadData.secure_url;

            console.log("Uploaded:", avatarUrl);

            // ✅ Lưu link vào backend database
            const res = await fetch(`${API}/profile/${userId}/avatar-url`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ avatarUrl }),
            });

            if (!res.ok) {
                alert("Save avatar failed!");
                return;
            }

            setProfile((p) => (p ? { ...p, avatarUrl } : p));

            const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
            currentUser.avatarUrl = avatarUrl;
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Upload avatar failed!");
        }
    };

    // ===== post media upload =====
    const handlePostMediaSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const uploadData = await uploadToCloudinary(file);
            const mediaUrl = uploadData.secure_url;
            setPostMediaUrls((prev) => [...prev, mediaUrl]);
        } catch (err) {
            console.error(err);
            alert("Upload image failed!");
        } finally {
            if (postMediaInputRef.current) postMediaInputRef.current.value = "";
        }
    };

    const removePostMedia = (url) => {
        setPostMediaUrls((prev) => prev.filter((u) => u !== url));
    };

    // ===== create post =====
    const createPost = async () => {
        const content = postContent.trim();
        if ((!content && postMediaUrls.length === 0) || !token) return;

        const res = await fetch(`${API}/posts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ content, mediaUrls: postMediaUrls }),
        });

        if (!res.ok) {
            console.error("Create post failed", await res.text());
            return;
        }

        setPostContent("");
        setPostMediaUrls([]);
        await loadPosts();
        window.location.reload();
    };

    const requestDelete = (postId) => {
        setDeleteTargetId(postId);
    };

    const cancelDelete = () => {
        if (deleteLoading) return;
        setDeleteTargetId(null);
    };

    const confirmDelete = async () => {
        if (!token || !deleteTargetId) return;

        try {
            setDeleteLoading(true);
            const res = await fetch(`${API}/posts/${deleteTargetId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                console.error("Delete post failed", await res.text());
                return;
            }

            setPosts((prev) => prev.filter((p) => p.id !== deleteTargetId));
            await loadProfile();
            setDeleteTargetId(null);
        } finally {
            setDeleteLoading(false);
        }
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

    if (!profile) {
        return (
            <div style={{ padding: 20, color: "#fff" }}>
                {loadingProfile ? "Loading profile..." : "No profile"}
            </div>
        );
    }



    const avatar = profile.avatarUrl;

    return (
        <div className="app-layout">

            <aside className="identity-col">
                <div className="dark-card profile-card">
                    <div className="cover-bg"></div>

                    <div className="profile-main">
                        <div className="avatar-shell">

                            {avatarMenuOpen && (
                                <div className="avatar-menu-backdrop" onClick={closeAvatarMenu} />
                            )}

                            <div className="avatar-wrapper" onClick={toggleAvatarMenu}>
                                <img id="avatar" src={avatar} alt="avatar" />
                            </div>

                            <div className={`avatar-menu ${avatarMenuOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
                                <button type="button" onClick={handleViewAvatar}>View avatar</button>
                            </div>
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
                    <Link className="menu-item active" to="/feed">
                        <i className="fa-solid fa-house"></i> Home
                    </Link>
                    <Link className="menu-item" to="/feed?tab=saved"><i className="fa-solid fa-bookmark"></i> Bookmarks</Link>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-image"></i> Media
                    </a>
                    <a className="menu-item" href="#">
                        <i className="fa-solid fa-gear"></i> Settings
                    </a>
                    <button
                        type="button"
                        className="menu-item menu-item-btn menu-logout"
                        onClick={handleLogout}
                    >
                        <i className="fa-solid fa-right-from-bracket"></i> Logout
                    </button>
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
                            <i
                                className="fa-regular fa-image icon-btn"
                                onClick={() => postMediaInputRef.current?.click()}
                            ></i>
                            <i className="fa-solid fa-video icon-btn"></i>
                            <i className="fa-solid fa-face-smile icon-btn"></i>
                            <i className="fa-solid fa-calendar-days icon-btn"></i>
                        </div>

                        <button className="post-btn" onClick={createPost}>
                            Post
                        </button>
                    </div>

                    <input
                        ref={postMediaInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={handlePostMediaSelect}
                    />

                    {postMediaUrls.length > 0 && (
                        <div className="composer-media">
                            {postMediaUrls.map((url) => (
                                <div className="media-thumb" key={url}>
                                    <img src={url} alt="media" />
                                    <button
                                        type="button"
                                        className="media-remove"
                                        onClick={() => removePostMedia(url)}
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
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
                                token={token}
                                pollLive={pollLive}
                                formatTime={formatTime}
                                onToggleLike={toggleLike}
                                viewerId={userId}
                                onCommentCountChange={commentCount => setPosts(previous =>
                                    previous.map(item => item.id === post.id ? { ...item, commentCount } : item))}
                                currentUserAvatar={avatar}
                                onDelete={() => requestDelete(post.id)}
                            />
                        ))
                    )}
                </div>

            </main>

            {deleteTargetId && (
                <div className="modal-backdrop" onClick={cancelDelete}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Delete post?</div>
                        <div className="modal-desc">
                            This action cannot be undone.
                        </div>
                        <div className="modal-actions">
                            <button
                                className="modal-btn ghost"
                                type="button"
                                onClick={cancelDelete}
                                disabled={deleteLoading}
                            >
                                Cancel
                            </button>
                            <button
                                className="modal-btn danger"
                                type="button"
                                onClick={confirmDelete}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}


            <input
                id="avatarFileInput"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="file-input-hidden"
                onChange={handleAvatarSelect}
            />


            {avatarPreviewOpen && (
                <div className="modal-backdrop" onClick={() => setAvatarPreviewOpen(false)}>
                    <div className="modal avatar-preview" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Avatar</div>
                        <div className="avatar-preview-body">
                            <img src={avatar} alt="avatar large" />
                        </div>
                        <div className="modal-actions">
                            <button
                                className="modal-btn ghost"
                                type="button"
                                onClick={() => setAvatarPreviewOpen(false)}
                            >
                                Close
                            </button>
                            <button className="modal-btn" type="button" onClick={(e) => handleChangeAvatar(e)}>
                                Change
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
