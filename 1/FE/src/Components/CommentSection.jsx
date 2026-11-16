import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import "./comment-thread.css";

function mergeComments(previous, incoming) {
  const rows = new Map(previous.map(comment => [comment.id, comment]));
  for (const comment of incoming) rows.set(comment.id, comment);
  return [...rows.values()].sort((left, right) => right.id - left.id);
}

function replaceComment(items, id, comment) {
  const remaining = items.filter(item => item.id !== id);
  return comment ? mergeComments(remaining, [comment]) : remaining;
}

function CommentForm({ label, value, onChange, onSubmit, onCancel, action, busy, focus }) {
  return <form className="comment-form" onSubmit={event => {
    event.preventDefault();
    if (value.trim() && !busy) onSubmit();
  }}>
    <label>
      {label}
      <textarea value={value} maxLength={1000} rows={2} autoFocus={focus}
        onChange={event => onChange(event.target.value)} disabled={busy} />
    </label>
    <div className="comment-tools">
      <button type="submit" className="btn-primary" disabled={busy || !value.trim()}>{action}</button>
      {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>}
    </div>
  </form>;
}

export default function CommentSection({
  isOpen, postId, token, viewerId, targetCommentId, isQuestion, acceptedAnswerId, canAccept,
  onDiscussionChange, currentUserAvatar, formatTime,
}) {
  const [page, setPage] = useState(null);
  const [replyPages, setReplyPages] = useState({});
  const [expanded, setExpanded] = useState({});
  const [draft, setDraft] = useState("");
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [failedTarget, setFailedTarget] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const loading = useRef(false);
  const loaded = useRef(false);
  const highlighted = useRef(false);
  const targetElement = useRef(null);
  const endpoint = "/api/comments/post/" + postId;
  const notifyDiscussion = useEffectEvent(patch => onDiscussionChange?.(patch));

  const request = useCallback(async (url, { method = "GET", body, signal } = {}) => {
    const headers = {};
    if (token) headers.Authorization = "Bearer " + token;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(url, { method, headers, body: body && JSON.stringify(body), signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = new Error(response.status === 401 ? "Sign in again to continue." : data?.message || "Unable to complete this action.");
      failure.status = response.status;
      throw failure;
    }
    return data;
  }, [token]);

  useEffect(() => {
    if (!isOpen || loaded.current) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    const targetRequest = targetCommentId
      ? request(endpoint + "/target/" + targetCommentId, options).catch(failure => {
        if (failure.status === 404) return null;
        throw failure;
      }) : Promise.resolve(null);
    Promise.all([request(endpoint, options), targetRequest]).then(([first, target]) => {
      if (controller.signal.aborted) return;
      loaded.current = true;
      const pinned = [target?.root, first.acceptedAnswer].filter(Boolean);
      setPage({ ...first, items: mergeComments(first.items, pinned) });
      notifyDiscussion({ commentCount: first.total, acceptedAnswerId: first.acceptedAnswer?.id ?? null });
      setFailedTarget(Boolean(targetCommentId && !target));
      if (target?.target.parentCommentId) {
        setExpanded({ [target.root.id]: true });
        setReplyPages({ [target.root.id]: { items: [target.target], nextBeforeId: null, loaded: false } });
      }
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [endpoint, isOpen, request, retry, targetCommentId]);

  useEffect(() => {
    if (!isOpen || highlighted.current || !targetElement.current) return;
    highlighted.current = true;
    targetElement.current.focus({ preventScroll: true });
    targetElement.current.scrollIntoView({ block: "center" });
  }, [isOpen, page, replyPages]);

  async function run(work) {
    if (loading.current) return;
    loading.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (failure) {
      setError(failure.message);
    } finally {
      loading.current = false;
      setBusy(false);
    }
  }

  function loadMoreRoots() {
    return run(async () => {
      const next = await request(endpoint + "?beforeId=" + page.nextBeforeId);
      setPage(previous => ({ ...next, items: mergeComments(previous.items, next.items) }));
      onDiscussionChange?.({ commentCount: next.total });
    });
  }

  async function loadReplies(rootId) {
    const cursor = replyPages[rootId]?.nextBeforeId;
    const next = await request(endpoint + "?parentCommentId=" + rootId + (cursor ? "&beforeId=" + cursor : ""));
    setReplyPages(previous => ({
      ...previous,
      [rootId]: { ...next, loaded: true, items: mergeComments(previous[rootId]?.items || [], next.items) },
    }));
    setExpanded(previous => ({ ...previous, [rootId]: true }));
    onDiscussionChange?.({ commentCount: next.total });
  }

  function updateDiscussion(result, commentId, parentId) {
    const root = parentId ? result.root : result.comment;
    setPage(previous => ({
      ...previous,
      items: replaceComment(previous.items, parentId || commentId, root),
      total: result.total,
    }));
    if (parentId) {
      setReplyPages(previous => ({
        ...previous,
        [parentId]: {
          ...(previous[parentId] || { loaded: false, nextBeforeId: null }),
          items: replaceComment(previous[parentId]?.items || [], commentId, result.comment),
        },
      }));
    }
    onDiscussionChange?.({ commentCount: result.total, acceptedAnswerId: result.acceptedAnswerId });
  }

  function createComment(content, parentCommentId = null, replyToCommentId = null) {
    return run(async () => {
      const result = await request("/api/comments", {
        method: "POST", body: { postId, parentCommentId, replyToCommentId, content: content.trim() },
      });
      if (result.comment) updateDiscussion(result, result.comment.id, parentCommentId);
      if (parentCommentId) setExpanded(previous => ({ ...previous, [parentCommentId]: true }));
      else setDraft("");
      setEditor(null);
    });
  }

  function saveEdit(row, value) {
    return run(async () => {
      const result = await request("/api/comments/" + row.id, { method: "PUT", body: { content: value.trim() } });
      updateDiscussion(result, row.id, row.parentCommentId);
      setEditor(null);
    });
  }

  function deleteComment(row) {
    return run(async () => {
      const result = await request("/api/comments/" + row.id, { method: "DELETE" });
      updateDiscussion(result, row.id, row.parentCommentId);
      setDeleting(null);
      setEditor(null);
    });
  }

  function setAnswer(commentId) {
    return run(async () => {
      const result = await request("/api/questions/" + postId + "/accepted-answer", {
        method: "PUT", body: { commentId },
      });
      onDiscussionChange?.({ acceptedAnswerId: result.acceptedAnswerId });
    });
  }

  function showComment(row, root) {
    const active = !row.isDeleted;
    const own = active && row.userId === viewerId;
    const targeted = row.id === targetCommentId;
    const accepted = row.id === acceptedAnswerId;
    const activeEditor = editor?.id === row.id ? editor : null;
    return <article id={"comment-" + row.id} className={"thread-comment" + (targeted ? " thread-highlight" : "") + (accepted ? " accepted-answer" : "")}
      key={row.id} tabIndex={targeted ? -1 : undefined} ref={targeted ? targetElement : undefined}>
      <div className="thread-comment-header">
        {active && <Avatar src={row.userAvatarUrl} className="c-avatar" alt="" />}
        <div>
          {active && <Link className="member-link" to={"/members/" + row.userId}><strong>{row.userDisplayName}</strong></Link>}
          <time dateTime={row.createdAt}>{formatTime(row.createdAt)}</time>
          {row.editedAt && <span className="thread-meta">Edited</span>}
        </div>
      </div>
      <p className={active ? "thread-text" : "thread-meta"}>{active ? row.content : "Comment deleted"}</p>
      {accepted && <span className="accepted-answer-label" role="status">✓ Accepted answer</span>}
      <div className="comment-tools">
        {active && !root.isDeleted && token && <button type="button" className="thread-action" disabled={busy}
          onClick={() => { setDeleting(null); setEditor({ id: row.id, mode: "reply", value: row.parentCommentId ? "@" + row.userDisplayName + " " : "" }); }}>
          Reply
        </button>}
        {own && <button type="button" className="thread-action" disabled={busy}
          onClick={() => { setDeleting(null); setEditor({ id: row.id, mode: "edit", value: row.content }); }}>Edit</button>}
        {own && <button type="button" className="thread-action" disabled={busy}
          onClick={() => { setEditor(null); setDeleting(row.id); }}>Delete</button>}
        {isQuestion && canAccept && active && row.parentCommentId == null && <button type="button"
          className="thread-action" disabled={busy} onClick={() => setAnswer(accepted ? null : row.id)}>
          {accepted ? "Reopen question" : "Accept answer"}
        </button>}
        <Link className="thread-action" to={"/posts/" + postId + "?comment=" + row.id} aria-label="Open comment link">Link</Link>
      </div>
      {activeEditor && <CommentForm
        label={activeEditor.mode === "edit" ? "Edit comment" : "Reply to " + row.userDisplayName}
        value={activeEditor.value} onChange={value => setEditor({ ...activeEditor, value })}
        onSubmit={() => activeEditor.mode === "edit" ? saveEdit(row, activeEditor.value) : createComment(activeEditor.value, root.id, row.id)}
        onCancel={() => setEditor(null)} action={activeEditor.mode === "edit" ? "Save comment" : "Send reply"}
        busy={busy} focus />}
      {deleting === row.id && <div className="comment-tools">
        <span>Delete this comment?</span>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => deleteComment(row)}>Confirm delete</button>
        <button type="button" className="thread-action" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button>
      </div>}
    </article>;
  }

  if (!isOpen) return null;
  return <section className="comment-thread" aria-label="Discussion" aria-busy={busy}>
    <h2>{isQuestion ? "Answers" : "Discussion"}</h2>
    {error && <p className="social-error" role="alert">{error}</p>}
    {failedTarget && <p className="thread-meta" role="status">This comment is no longer available.</p>}
    {!page && (error
      ? <button type="button" className="btn-secondary" onClick={() => { setError(""); setRetry(value => value + 1); }}>Retry</button>
      : <p className="thread-meta" role="status">Loading comments…</p>)}
    {page && token && <div className="thread-composer">
      <Avatar src={currentUserAvatar} className="c-avatar" alt="" />
      <CommentForm label={isQuestion ? "Write an answer" : "Write a comment"} value={draft} onChange={setDraft}
        onSubmit={() => createComment(draft)} action={isQuestion ? "Post answer" : "Post comment"} busy={busy} />
    </div>}
    {page?.items.length === 0 && <p className="thread-meta">{isQuestion ? "No answers yet." : "No comments yet."}</p>}
    {page?.items.toSorted((left, right) => Number(right.id === acceptedAnswerId) - Number(left.id === acceptedAnswerId)).map(root => {
      const replies = replyPages[root.id];
      const open = expanded[root.id];
      return <div key={root.id} className="thread-root">
        {showComment(root, root)}
        {root.replyCount > 0 && <button type="button" className="thread-action thread-reply-toggle"
          aria-expanded={!!open} disabled={busy}
          onClick={() => {
            if (open || replies?.items.length) setExpanded(previous => ({ ...previous, [root.id]: !open }));
            else run(() => loadReplies(root.id));
          }}>
          {open ? "Hide replies" : "Show replies (" + root.replyCount + ")"}
        </button>}
        {open && root.replyCount > 0 && <div className="thread-replies">
          {replies?.items.map(reply => showComment(reply, root))}
          {(replies?.nextBeforeId || (!replies?.loaded && (replies?.items.length || 0) < root.replyCount)) &&
            <button type="button" className="thread-action" disabled={busy} onClick={() => run(() => loadReplies(root.id))}>Load more replies</button>}
        </div>}
      </div>;
    })}
    {page?.nextBeforeId && <button type="button" className="btn-secondary" onClick={loadMoreRoots} disabled={busy}>Load more comments</button>}
  </section>;
}
