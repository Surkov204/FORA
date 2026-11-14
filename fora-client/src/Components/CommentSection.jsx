import Avatar from "./Avatar";

export default function CommentSection({
  isOpen,
  comments,
  inputValue,
  onInputChange,
  onSubmit,
  currentUserAvatar,
  formatTime,
}) {
  if (!isOpen) return null;

  return (
    <div className="comment-section open">
      <div className="comment-list">
        {(comments || []).length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", padding: 10 }}>
            No comments yet.
          </div>
        ) : (
          (comments || []).map((c) => (
            <div
              className="c-item"
              key={c.id || `${c.userDisplayName}-${c.createdAt}`}
            >
              <Avatar
                src={c.userAvatarUrl}
                className="c-avatar"
                alt="c"
              />
              <div className="c-content-box">
                <div>
                  <span className="c-name">{c.userDisplayName}</span>
                  <span className="c-time">{formatTime(c.createdAt)}</span>
                </div>
                <span className="c-text">{c.content}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="comment-input-wrapper">
        <Avatar src={currentUserAvatar} className="c-avatar" alt="me" />
        <input
          className="c-input"
          placeholder="Post your reply..."
          value={inputValue || ""}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <button className="c-send-btn" type="button" onClick={onSubmit}>
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
}
