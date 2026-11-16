import { useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "./Avatar";
import CommentSection from "./CommentSection";
import PostPoll from "./PostPoll";

export default function PostCard({
  post,
  formatTime,
  onToggleLike,
  viewerId,
  targetCommentId,
  openComments = false,
  onCommentCountChange,

  currentUserAvatar,
  onDelete,
  onEdit,
  onBookmark,
  busy = false,
  token,
  pollLive,
}) {
  const [commentsOpen, setCommentsOpen] = useState(openComments);
  return (
    <div className="post-card" data-post-id={post.id}>
      <div className="p-header">
        <Avatar className="avatar-tiny" src={post.userAvatar} alt="u" />
        <div className="p-info">
          {post.userId ? <Link className="p-name member-link" to={"/members/" + post.userId}>{post.userDisplayName || "User"}</Link> :
            <span className="p-name">{post.userDisplayName || "User"}</span>}
          <Link className="p-time" to={`/posts/${post.id}`} aria-label="Open post">
            {formatTime(post.createdAt)}
          </Link>
        </div>
        {onEdit && <button className="act-btn" type="button" onClick={onEdit} aria-label="Edit post" disabled={busy}><i className="fa-solid fa-pen" /></button>}
        {onDelete && (
          <button
            className="post-menu-btn"
            type="button"
            onClick={onDelete}
            aria-label="Post options"
          >
            <i className="fa-solid fa-ellipsis"></i>
          </button>
        )}
      </div>

      <div className="p-content">{post.content}</div>
      {post.poll && token && <PostPoll poll={post.poll} token={token} live={pollLive} />}
      {post.media && post.media.length > 0 && (
        <div className="post-media-grid">
          {post.media.map((m, idx) => {
            const url = typeof m === "string" ? m : m.url;
            const type = typeof m === "string" ? "image" : m.type;
            return (
              <div className="post-media-item" key={`${url || "m"}-${idx}`}>
                {type === "image" && <img src={url} alt="media" />}
              </div>
            );
          })}
        </div>
      )}

      <div className="p-actions">
        <button
          className="act-btn comment"
          type="button"
          onClick={() => setCommentsOpen(!commentsOpen)}
          aria-label={`Comments (${post.commentCount || 0})`}
          aria-expanded={commentsOpen}
        >
          <i className="fa-regular fa-comment"></i>
          <span>{post.commentCount || 0}</span>
        </button>

        {onBookmark && <button className={`act-btn ${post.isSaved ? "saved" : ""}`} type="button" onClick={onBookmark} disabled={busy} aria-label={post.isSaved ? "Unsave post" : "Save post"} aria-pressed={!!post.isSaved}><i className={post.isSaved ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark"} /></button>}

        <button
          className={`act-btn heart ${post.isLiked ? "liked" : ""}`}
          type="button"
          onClick={() => onToggleLike(post.id)}
          disabled={busy}
        >
          <i
            className={post.isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart"}
          ></i>
          <span className="like-count">{post.likeCount || 0}</span>
        </button>

      </div>

      <CommentSection
        isOpen={commentsOpen}
        postId={post.id}
        token={token}
        viewerId={viewerId}
        targetCommentId={targetCommentId}
        onCountChange={onCommentCountChange}
        currentUserAvatar={currentUserAvatar}
        formatTime={formatTime}
      />
    </div>
  );
}
