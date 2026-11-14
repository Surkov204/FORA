import Avatar from "./Avatar";
import CommentSection from "./CommentSection";

export default function PostCard({
  post,
  formatTime,
  onToggleComments,
  onToggleLike,

  // comment props
  commentsOpen,
  comments,
  commentInputValue,
  onCommentInputChange,
  onSubmitComment,

  currentUserAvatar,
  onDelete,
}) {
  return (
    <div className="post-card" data-post-id={post.id}>
      <div className="p-header">
        <Avatar className="avatar-tiny" src={post.userAvatar} alt="u" />
        <div className="p-info">
          <span className="p-name">{post.userDisplayName || "User"}</span>
          <span className="p-time">{formatTime(post.createdAt)}</span>
        </div>
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
          onClick={() => onToggleComments(post.id)}
        >
          <i className="fa-regular fa-comment"></i>
          <span>{post.commentCount || 0}</span>
        </button>

        <button className="act-btn share" type="button">
          <i className="fa-solid fa-retweet"></i>
          <span>0</span>
        </button>

        <button
          className={`act-btn heart ${post.isLiked ? "liked" : ""}`}
          type="button"
          onClick={() => onToggleLike(post.id)}
        >
          <i
            className={post.isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart"}
          ></i>
          <span className="like-count">{post.likeCount || 0}</span>
        </button>

        <button className="act-btn" type="button">
          <i className="fa-solid fa-share-nodes"></i>
        </button>
      </div>

      <CommentSection
        isOpen={commentsOpen}
        comments={comments}
        inputValue={commentInputValue}
        onInputChange={onCommentInputChange}
        onSubmit={onSubmitComment}
        currentUserAvatar={currentUserAvatar}
        formatTime={formatTime}
      />
    </div>
  );
}
