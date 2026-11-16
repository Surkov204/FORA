import { useRef, useState } from "react";
import "./post-reactions.css";

const choices = [
  { kind: "like", symbol: "❤️", label: "Like" },
  { kind: "helpful", symbol: "👍", label: "Helpful" },
  { kind: "funny", symbol: "😂", label: "Funny" },
  { kind: "celebrate", symbol: "🎉", label: "Celebrate" },
];

export default function PostReactions({ postId, token, summary, onChange }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);

  async function react(kind) {
    if (!token || locked.current) return;
    locked.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/likes/" + postId, {
        method: "PUT",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ kind: summary?.myReaction === kind ? null : kind }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Sign in again to react." : data?.message || "Unable to save your reaction.");
      }
      onChange(data);
    } catch (failure) {
      setError(failure.message);
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return <div className="post-reactions">
    <div className="reaction-choices" role="group" aria-label="Post reactions" aria-busy={pending}>
      {choices.map(({ kind, symbol, label }) => {
        const count = summary?.[kind] || 0;
        return <button key={kind} type="button" className="reaction-choice" title={label}
          aria-label={label + " (" + count + ")"} aria-pressed={summary?.myReaction === kind}
          disabled={pending || !token} data-reaction={kind} onClick={() => react(kind)}>
          <span aria-hidden="true">{symbol}</span>
          {count > 0 && <span className="reaction-count" aria-hidden="true">{count}</span>}
        </button>;
      })}
    </div>
    {error && <p className="reaction-error" role="alert">{error}</p>}
  </div>;
}
