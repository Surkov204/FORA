import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { PollResultsContext, useLiveCommunity } from "../hooks/useLivePolls";
import { session } from "../session";
import "./notifications.css";

function notificationText(item) {
  switch (item.kind) {
    case "reply": return "replied to your comment";
    case "comment": return "commented on your post";
    case "follow": return "followed you";
    default: return "sent an update";
  }
}

export default function NotificationsLayout() {
  const [auth] = useState(session);
  const { pollResults, inboxVersion } = useLiveCommunity(auth?.token);
  return <PollResultsContext.Provider value={pollResults}>
    {auth && <NotificationsBar token={auth.token} inboxVersion={inboxVersion} />}
    <Outlet />
  </PollResultsContext.Provider>;
}

function NotificationsBar({ token, inboxVersion }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listRequest = useRef(null);
  const container = useRef(null);
  const trigger = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async beforeId => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    try {
      const query = beforeId ? "?beforeId=" + beforeId : "";
      const response = await fetch("/api/notifications" + query, {
        headers: { Authorization: "Bearer " + token }, signal: controller.signal,
      });
      if (!response.ok) throw new Error("Unable to load notifications.");
      const data = await response.json();
      if (controller.signal.aborted) return;
      setPage(previous => beforeId && previous ? { ...data, items: [...previous.items, ...data.items] } : data);
      setError("");
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message);
    }
  }, [token]);

  useEffect(() => {
    // The shared connection also refreshes the inbox when it reconnects.
    void load();
    return () => {
      listRequest.current?.abort();
    };
  }, [load, inboxVersion]);

  useEffect(() => {
    if (!open) return;
    const dismiss = event => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    const escape = event => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function markRead(item) {
    if (busy) return;
    setBusy(true);
    try {
      if (!item || !item.isRead) {
        const path = item ? item.id + "/read" : "read-all";
        const response = await fetch("/api/notifications/" + path, {
          method: "PUT", headers: { Authorization: "Bearer " + token },
        });
        if (!response.ok) throw new Error("Unable to mark notifications as read.");
        await load();
      }
      if (item) {
        setOpen(false);
        const destination = item.postId
          ? "/posts/" + item.postId + "?comment=" + item.commentId
          : "/members/" + item.actorId;
        navigate(destination);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <header className="notifications-bar">
    <Link to="/feed">FORA</Link>
    <div className="notifications-menu" ref={container}>
      <button type="button" className="notifications-trigger" ref={trigger}
        aria-label={"Notifications" + (page?.unread ? " (" + page.unread + " unread)" : "")}
        aria-expanded={open} aria-controls="notification-inbox"
        onClick={() => { if (!open) void load(); setOpen(!open); }}>
        <Bell size={21} aria-hidden="true" />
        {page?.unread > 0 && <span aria-hidden="true">{page.unread > 99 ? "99+" : page.unread}</span>}
      </button>
      {open && <section id="notification-inbox" className="notification-inbox" aria-label="Notifications" aria-busy={busy}>
        <div className="notification-heading">
          <h2>Notifications</h2>
          {page?.unread > 0 && <button type="button" className="notification-action" disabled={busy}
            onClick={() => markRead()}>Mark all as read</button>}
        </div>
        {error && <p role="alert">{error} <button type="button" className="notification-action" onClick={() => load()}>Retry</button></p>}
        {!page && !error && <p role="status">Loading notifications…</p>}
        {page?.items.length === 0 && <p>No notifications yet.</p>}
        {page?.items.length > 0 && <ul>
          {page.items.map(item => <li key={item.id}>
            <button type="button" className={item.isRead ? "notification-item" : "notification-item unread"}
              disabled={busy} onClick={() => markRead(item)}>
              <span><strong>{item.actorName}</strong> {notificationText(item)}</span>
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </button>
          </li>)}
        </ul>}
        {page?.nextBeforeId && <button type="button" className="notification-action" disabled={busy}
          onClick={() => load(page.nextBeforeId)}>Load more notifications</button>}
      </section>}
    </div>
  </header>;
}
