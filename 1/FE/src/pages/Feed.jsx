import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import PostCard from "../Components/PostCard";
import Avatar from "../Components/Avatar";
import { useLivePolls } from "../hooks/useLivePolls";
import { session } from "../session";
import "./profile.css";
import "./feed.css";

export default function Feed() {
  const [auth] = useState(session);
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0 });
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get("tab") === "saved" ? "saved" : "latest");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState([]);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [pollOptions, setPollOptions] = useState(null);
  const [pollDuration, setPollDuration] = useState(24);
  const [busy, setBusy] = useState({});
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const sequence = useRef(0);
  const locks = useRef(new Set());
  const dialogRef = useRef(null);
  const pollLive = useLivePolls();

  useEffect(() => {
    if (!editing && !deleting) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), textarea, [href]')];
    focusable()[0]?.focus();
    const onKey = event => {
      if (event.key === "Escape" && !locks.current.has("edit") && !locks.current.has("delete")) { setEditing(null); setDeleting(null); }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    dialog.addEventListener("keydown", onKey);
    return () => { dialog.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [!!editing, !!deleting]);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`/api${path}`, { ...options, headers: { Authorization: `Bearer ${auth?.token}`, "Content-Type": "application/json", ...options.headers } });
    if (response.status === 401) { localStorage.removeItem("token"); window.location.assign("/auth"); throw new Error("Please sign in again."); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || (response.status === 403 ? "You do not have permission." : "Unable to complete this action. Please try again."));
    return data;
  }, [auth]);

  const action = async (key, fn) => {
    if (locks.current.has(key)) return;
    locks.current.add(key); setBusy(b => ({ ...b, [key]: true })); setError("");
    try { await fn(); } catch (e) { setError(e.message); }
    finally { locks.current.delete(key); setBusy(b => ({ ...b, [key]: false })); }
  };

  const load = useCallback(async (nextPage = 1) => {
    const version = ++sequence.current;
    setLoading(true); setError("");
    try {
      const data = await request(`/social/feed?tab=${tab}&q=${encodeURIComponent(query)}&page=${nextPage}`);
      if (version !== sequence.current) return;
      setPosts(old => nextPage === 1 ? data.items : [...old, ...data.items.filter(p => !old.some(o => o.id === p.id))]);
      setPage(nextPage); setHasMore(data.hasMore);
    } catch (e) { if (version === sequence.current) setError(e.message); }
    finally { if (version === sequence.current) setLoading(false); }
  }, [request, tab, query]);

  useEffect(() => { if (auth) load(); return () => { sequence.current++; }; }, [auth, load]);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    Promise.all([request(`/profile/${auth.id}`), request("/social/stats")])
      .then(([p, s]) => { if (active) { setProfile(p); setStats(s); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [auth, request]);
  useEffect(() => {
    if (!auth) return;
    let active = true;
    request(`/social/people?q=${encodeURIComponent(query)}`).then(p => { if (active) setPeople(p); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [auth, query, request]);

  if (!auth) return <Navigate to="/auth" replace />;
  const update = (id, patch) => setPosts(old => old.map(p => p.id === id ? { ...p, ...patch } : p));
  const time = value => new Date(value).toLocaleString();
  const options = pollOptions?.map(option => option.trim());
  const validPoll = !options || (
    options.every(Boolean) && new Set(options.map(option => option.toLowerCase())).size === options.length
  );
  const submitPost = () => action("create", async () => {
    const post = { content: content.trim() };
    if (options) post.poll = { options, durationHours: pollDuration };
    await request("/posts", { method: "POST", body: JSON.stringify(post) });
    setContent("");
    setPollOptions(null);
    setPollDuration(24);
    await load();
  });

  return <div className="app-layout social-layout">
    <aside className="identity-col">
      <div className="dark-card profile-card">
        <div className="cover-bg" />
        <div className="profile-main">
          <div className="avatar-shell"><Avatar src={profile?.avatarUrl} className="social-avatar" alt="Your avatar" /></div>
          <h1>{profile?.displayName || "Your space"}</h1>
          <p className="bio">{profile?.bio || "Share something with your community."}</p>
          <div className="stats-row"><div className="stat"><b>{stats.followerCount}</b><span>Followers</span></div><div className="stat"><b>{stats.followingCount}</b><span>Following</span></div></div>
          <Link className="btn-primary social-profile-link" to="/profile">Edit profile</Link>
        </div>
      </div>
      <nav className="dark-card menu-card" aria-label="Main navigation">
        <button className={`menu-item menu-item-btn ${tab !== "saved" ? "active" : ""}`} onClick={() => setTab("latest")}><i className="fa-solid fa-house" /> Feed</button>
        <button className={`menu-item menu-item-btn ${tab === "saved" ? "active" : ""}`} onClick={() => setTab("saved")}><i className="fa-regular fa-bookmark" /> Bookmarks</button>
        <Link className="menu-item" to="/profile"><i className="fa-regular fa-user" /> My profile</Link>
        <button className="menu-item menu-item-btn menu-logout" onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("currentUser"); window.location.assign("/auth"); }}><i className="fa-solid fa-right-from-bracket" /> Logout</button>
      </nav>
      <section className="dark-card people-card"><h2>{query ? "People matching your search" : "Discover people"}</h2>
        {people.length === 0 && <p className="social-muted">{query ? "No people found." : "More people will appear when they join FORA."}</p>}
        {people.map(person => <div className="person-row" key={person.userId}>
          <Avatar src={person.avatarUrl} className="avatar-tiny" alt="" />
          <div className="person-info">
            <Link className="member-link" to={"/members/" + person.userId}><b>{person.displayName}</b></Link>
            <small>{person.followerCount} followers</small>
          </div>
          <button className={person.isFollowing ? "btn-secondary" : "btn-primary"} disabled={busy[`follow-${person.userId}`]} onClick={() => action(`follow-${person.userId}`, async () => {
            await request(`/social/follow/${person.userId}`, { method: "PUT", body: JSON.stringify({ active: !person.isFollowing }) });
            setPeople(old => old.map(p => p.userId === person.userId ? { ...p, isFollowing: !p.isFollowing, followerCount: p.followerCount + (p.isFollowing ? -1 : 1) } : p));
            setStats(await request("/social/stats")); if (tab === "following") await load();
          })}>{person.isFollowing ? "Following" : "Follow"}</button>
        </div>)}
      </section>
    </aside>
    <main className="content-col social-main">
      <header className="social-heading"><div><span className="social-eyebrow">YOUR COMMUNITY</span><h1>{tab === "saved" ? "Bookmarks" : "Home feed"}</h1></div><button className="btn-secondary" disabled={loading} onClick={() => load()}>Refresh</button></header>
      <form className="social-search dark-card" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }}><i className="fa-solid fa-magnifying-glass" /><input aria-label="Search posts and people" placeholder="Search posts and people" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /><button className="btn-primary" type="submit">Search</button>{query && <button type="button" className="btn-secondary" onClick={() => { setSearch(""); setQuery(""); }}>Clear</button>}</form>
      {error && <div className="social-error" role="alert">{error}</div>}
      <section className="dark-card composer-card">
        <div className="composer-top">
          <Avatar src={profile?.avatarUrl} className="avatar-tiny" alt="" />
          <textarea aria-label={pollOptions ? "Poll question" : "New post"}
            placeholder={pollOptions ? "Ask your community a question…" : "What is happening?!"}
            maxLength={5000} value={content} onChange={e => setContent(e.target.value)} />
        </div>
        {pollOptions && <fieldset className="poll-editor" disabled={busy.create}>
          <legend>Poll choices</legend>
          {pollOptions.map((option, index) => <label key={index}>
            Option {index + 1}
            <input value={option} maxLength={80}
              onChange={e => setPollOptions(previous => previous.map((text, position) => position === index ? e.target.value : text))} />
          </label>)}
          <div className="poll-controls">
            {pollOptions.length < 4 && <button type="button" className="btn-secondary" onClick={() => setPollOptions(previous => [...previous, ""])}>Add option</button>}
            {pollOptions.length > 2 && <button type="button" className="btn-secondary" onClick={() => setPollOptions(previous => previous.slice(0, -1))}>Remove last option</button>}
          </div>
          <label>Voting closes in
            <select value={pollDuration} onChange={e => setPollDuration(Number(e.target.value))}>
              <option value={1}>1 hour</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </label>
          {!validPoll && <small className="social-muted">Enter a different label for each option.</small>}
        </fieldset>}
        <div className="composer-actions poll-controls">
          <button type="button" className="btn-secondary" disabled={busy.create}
            onClick={() => setPollOptions(previous => previous ? null : ["", ""])}>
            {pollOptions ? "Remove poll" : "Create poll"}
          </button>
          <span className="social-muted">{content.length}/5000</span>
          <button type="button" className="post-btn" disabled={!content.trim() || !validPoll || busy.create} onClick={submitPost}>
            {busy.create ? "Posting…" : pollOptions ? "Post poll" : "Post"}
          </button>
        </div>
      </section>
      <div className="feed-filter social-tabs" role="tablist" aria-label="Feed filters">{[["latest", "Latest"], ["following", "Following"], ["saved", "Saved"]].map(([value, label]) => <button role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
      {query && <p className="social-muted">Results for “{query}”</p>}
      <div className="feed-grid" aria-busy={loading}>
        {posts.map(post => <PostCard key={post.id} post={post} formatTime={time} currentUserAvatar={profile?.avatarUrl} busy={!!busy[`post-${post.id}`]}
          token={auth.token} pollLive={pollLive}
          onEdit={post.userId === auth.id && !post.poll ? () => setEditing({ id: post.id, content: post.content }) : undefined}
          onDelete={post.userId === auth.id ? () => setDeleting(post.id) : undefined}
          onBookmark={() => action(`post-${post.id}`, async () => { await request(`/social/bookmarks/${post.id}`, { method: "PUT", body: JSON.stringify({ active: !post.isSaved }) }); if (tab === "saved") await load(); else update(post.id, { isSaved: !post.isSaved }); })}
          onToggleLike={id => action(`post-${id}`, async () => update(id, await request(`/likes/${id}`, { method: "POST" })))}
          viewerId={auth.id}
          onCommentCountChange={commentCount => update(post.id, { commentCount })}
        />)}
      </div>
      {loading && <p className="social-empty" role="status">Loading posts…</p>}
      {!loading && !error && posts.length === 0 && <div className="dark-card social-empty"><i className="fa-regular fa-comment" /><h2>{tab === "saved" ? "Your saved posts live here" : tab === "following" ? "Build your own feed" : "No posts yet"}</h2><p>{tab === "saved" ? "Tap the bookmark on a post to keep it for later." : tab === "following" ? "Follow people to see their latest updates here." : query ? "Try a different search." : "Be the first to share something."}</p></div>}
      {hasMore && <button className="btn-secondary social-more" disabled={loading} onClick={() => load(page + 1)}>Load more</button>}
    </main>
    {editing && <div className="social-modal-backdrop"><section className="dark-card social-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="edit-title"><h2 id="edit-title">Edit post</h2><textarea autoFocus aria-label="Post content" maxLength={5000} value={editing.content} onChange={e => setEditing(old => ({ ...old, content: e.target.value }))} /><div className="social-modal-actions"><button className="btn-secondary" disabled={busy.edit} onClick={() => setEditing(null)}>Cancel</button><button className="btn-primary" disabled={!editing.content.trim() || busy.edit} onClick={() => action("edit", async () => { const result = await request(`/social/posts/${editing.id}`, { method: "PUT", body: JSON.stringify({ content: editing.content }) }); update(editing.id, { content: result.content }); setEditing(null); })}>{busy.edit ? "Saving…" : "Save changes"}</button></div>{error && <p role="alert" className="social-error">{error}</p>}</section></div>}
    {deleting && <div className="social-modal-backdrop"><section className="dark-card social-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete post?</h2><p>This will remove your post and its comments.</p><div className="social-modal-actions"><button className="btn-secondary" disabled={busy.delete} onClick={() => setDeleting(null)}>Cancel</button><button className="btn-primary" disabled={busy.delete} onClick={() => action("delete", async () => { await request(`/posts/${deleting}`, { method: "DELETE" }); setDeleting(null); await load(); })}>Delete</button></div>{error && <p role="alert" className="social-error">{error}</p>}</section></div>}
  </div>;
}
