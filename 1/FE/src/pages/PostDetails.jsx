import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import PostCard from "../Components/PostCard";
import { useLivePolls } from "../hooks/useLivePolls";
import { session } from "../session";
import "./profile.css";

async function request(token, path, { method = "GET", body, signal } = {}) {
  const headers = { Authorization: "Bearer " + token };
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch("/api" + path, { method, headers, body: body && JSON.stringify(body), signal });
  if (response.status === 401) {
    localStorage.removeItem("token");
    return null;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || "Unable to load this post.");
  return data;
}

export default function PostDetails() {
  const { postId } = useParams();
  const location = useLocation();
  const target = new URLSearchParams(location.search).get("comment");
  const targetCommentId = /^\d+$/.test(target ?? "") && Number(target) <= 2147483647 ? Number(target) : undefined;
  return <PostDetailsContent key={postId + ":" + (targetCommentId || "")} postId={postId}
    targetCommentId={targetCommentId} returnTo={location.pathname + location.search} />;
}

function PostDetailsContent({ postId, targetCommentId, returnTo }) {
  const [auth, setAuth] = useState(session);
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const inProgress = useRef(false);
  const pollLive = useLivePolls();
  const validId = /^\d+$/.test(postId) && Number(postId) > 0 && Number(postId) <= 2147483647;

  useEffect(() => {
    if (!auth || !validId) return;
    const controller = new AbortController();
    request(auth.token, "/social/posts/" + postId, { signal: controller.signal }).then(data => {
      if (controller.signal.aborted) return;
      if (data) setPost(data);
      else setAuth(null);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [auth, postId, retry, validId]);

  async function changePost(action) {
    if (inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setError("");
    try {
      const patch = await action();
      if (patch) setPost(previous => ({ ...previous, ...patch }));
      else setAuth(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }

  if (!auth) return <Navigate to="/auth" replace state={{ returnTo }} />;
  return <main className="post-details">
    <nav aria-label="Post navigation"><Link className="btn-secondary" to="/feed">Back to feed</Link></nav>
    {error && <p className="social-error" role="alert">{error}</p>}
    {!validId && <p>This post is no longer available.</p>}
    {validId && !post && (error
      ? <button type="button" className="btn-secondary" onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry</button>
      : <p role="status">Loading post…</p>)}
    {post && <div className="dark-card">
      <PostCard post={post} viewerId={auth.id} token={auth.token} pollLive={pollLive}
        openComments targetCommentId={targetCommentId} busy={busy}
        formatTime={value => new Date(value).toLocaleString()}
        onCommentCountChange={commentCount => setPost(previous => ({ ...previous, commentCount }))}
        onToggleLike={() => changePost(() => request(auth.token, "/likes/" + post.id, { method: "POST" }))}
        onBookmark={() => changePost(() => request(auth.token, "/social/bookmarks/" + post.id,
          { method: "PUT", body: { active: !post.isSaved } }))} />
    </div>}
  </main>;
}
