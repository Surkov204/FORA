import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import Avatar from "../Components/Avatar";
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
  if (!response.ok) throw new Error(data?.message || (response.status === 404 ? "This member is unavailable." : "Unable to load this member."));
  return data;
}

export default function MemberProfile() {
  const { userId } = useParams();
  const { pathname } = useLocation();
  return <MemberProfileContent key={userId} userId={userId} returnTo={pathname} />;
}

function MemberProfileContent({ userId, returnTo }) {
  const [auth, setAuth] = useState(session);
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const locked = useRef(false);
  const live = useLivePolls();
  const valid = /^\d+$/.test(userId) && Number(userId) > 0 && Number(userId) <= 2147483647;
  const endpoint = "/social/members/" + userId + "/posts";

  useEffect(() => {
    if (!auth || !valid) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    Promise.all([request(auth.token, "/profile/" + userId, options), request(auth.token, endpoint, options)])
      .then(([member, page]) => {
        if (controller.signal.aborted) return;
        if (!member || !page) {
          setAuth(null);
          return;
        }
        setProfile(member);
        setFollowing(page.isFollowing);
        setPosts(page.items);
        setNextBeforeId(page.nextBeforeId);
      }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [auth, endpoint, retry, userId, valid]);

  async function act(path, options, apply) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request(auth.token, path, options);
      if (data) apply(data);
      else setAuth(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function patchPost(id, patch) {
    setPosts(previous => previous.map(post => post.id === id ? { ...post, ...patch } : post));
  }

  if (!auth) return <Navigate to="/auth" replace state={{ returnTo }} />;
  const own = auth.id === Number(userId);
  return <main className="post-details member-profile">
    <nav aria-label="Member navigation"><Link className="btn-secondary" to="/feed">Back to feed</Link></nav>
    {error && <p className="social-error" role="alert">{error}</p>}
    {!valid && <p>This member is unavailable.</p>}
    {valid && !profile && (error
      ? <button type="button" className="btn-secondary" onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry</button>
      : <p role="status">Loading profile…</p>)}
    {profile && <>
      <section className="dark-card member-summary">
        <Avatar src={profile.avatarUrl} className="social-avatar" alt="" />
        <h1>{profile.displayName}</h1>
        {profile.bio && <p>{profile.bio}</p>}
        <div className="member-stats">
          <span>{profile.postCount} posts</span>
          <span>{profile.followerCount} followers</span>
          <span>{profile.followingCount} following</span>
        </div>
        {own ? <Link className="btn-secondary" to="/profile">Edit profile</Link> :
          <button type="button" className="btn-primary" disabled={busy} aria-pressed={following}
            onClick={() => act("/social/follow/" + userId, { method: "PUT", body: { active: !following } }, result => {
              setFollowing(result.isFollowing);
              setProfile(previous => ({ ...previous, followerCount: result.followerCount }));
            })}>{following ? "Unfollow" : "Follow"}</button>}
      </section>
      <section className="dark-card" aria-label="Member posts">
        {posts.length === 0 && <p className="member-summary">No posts yet.</p>}
        {posts.map(post => <PostCard key={post.id} post={post} viewerId={auth.id} token={auth.token}
          pollLive={live} busy={busy} formatTime={value => new Date(value).toLocaleString()}
          onDiscussionChange={patch => patchPost(post.id, patch)}
          onReactionChange={patch => patchPost(post.id, patch)}
          onBookmark={() => act("/social/bookmarks/" + post.id, { method: "PUT", body: { active: !post.isSaved } },
            data => patchPost(post.id, data))} />)}
      </section>
      {nextBeforeId && <button type="button" className="btn-secondary" disabled={busy}
        onClick={() => act(endpoint + "?beforeId=" + nextBeforeId, {}, data => {
          setPosts(previous => [...previous, ...data.items]);
          setNextBeforeId(data.nextBeforeId);
        })}>Load more posts</button>}
    </>}
  </main>;
}
