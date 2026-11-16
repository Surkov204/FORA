import { useEffect, useRef, useState } from "react";
import { voteTotal } from "../hooks/useLivePolls";
import "./post-poll.css";

export default function PostPoll({ poll, token, live }) {
  const { postId, closesAt } = poll;
  const update = live.results.get(postId);
  const [saved, setSaved] = useState(null);
  const [closedAt, setClosedAt] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const voteInProgress = useRef(false);
  const syncedConnection = useRef(live.connectionVersion);

  useEffect(() => {
    const remaining = Date.parse(closesAt) - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setClosedAt(closesAt), remaining);
    return () => clearTimeout(timer);
  }, [closesAt]);

  useEffect(() => {
    if (live.connectionVersion === syncedConnection.current) return;
    const controller = new AbortController();
    fetch(`/api/posts/${postId}/poll`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    }).then(async response => {
      if (!response.ok) return;
      const snapshot = await response.json();
      if (controller.signal.aborted) return;
      syncedConnection.current = live.connectionVersion;
      setSaved(previous => previous && voteTotal(previous.options) > voteTotal(snapshot.options) ? previous : snapshot);
    }).catch(() => {});
    return () => controller.abort();
  }, [live.connectionVersion, postId, token]);

  const myOption = saved?.myOption ?? poll.myOption;
  const options = [poll.options, saved?.options, update?.options].reduce((latest, candidate) =>
    candidate && voteTotal(candidate) >= voteTotal(latest) ? candidate : latest);
  const total = voteTotal(options);
  const closed = closedAt === closesAt || Date.parse(closesAt) <= Date.now();

  async function vote(optionNumber) {
    if (voteInProgress.current || myOption != null || closed) return;
    voteInProgress.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${postId}/poll/vote`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ optionNumber }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.poll) setSaved(data.poll);
        throw new Error(response.status === 401 ? "Sign in again to vote." : data?.message || "Unable to vote. Try again.");
      }
      setSaved(data);
    } catch (failure) {
      setError(failure.message);
    } finally {
      voteInProgress.current = false;
      setPending(false);
    }
  }

  return <section className="post-poll" aria-label="Poll" aria-busy={pending}>
    <div className="poll-heading">
      <strong>Poll</strong>
      {closed ? <span>Closed</span> : <span className={live.connected ? "poll-live" : ""}>{live.connected ? "Live results" : "Updates paused"}</span>}
    </div>
    <ul className="poll-options">
      {options.map(option => {
        const percent = total ? Math.round(option.voteCount * 100 / total) : 0;
        const selected = myOption === option.number;
        return <li key={option.number}>
          <button type="button" className={selected ? "poll-option selected" : "poll-option"}
            onClick={() => vote(option.number)} disabled={closed || pending || myOption != null}>
            <span className="poll-fill" style={{ width: `${percent}%` }} aria-hidden="true" />
            <span className="poll-choice">{option.text}{selected && <small> · Your vote</small>}</span>
            <span className="poll-percent">{percent}%</span>
          </button>
        </li>;
      })}
    </ul>
    <div className="poll-summary">
      <span role="status">{total} {total === 1 ? "vote" : "votes"}</span>
      <span>{closed ? "Ended" : "Ends"} <time dateTime={closesAt}>{new Date(closesAt).toLocaleString()}</time></span>
    </div>
    {error && <p className="social-error" role="alert">{error}</p>}
  </section>;
}
