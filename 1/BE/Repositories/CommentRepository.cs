using FORA.Data;
using FORA.DTOs;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories;

public sealed class CommentRepository(AppDbContext db) : ICommentRepository
{
    private IQueryable<Comment> Active => db.Comments.Where(comment => comment.DeletedAt == null);

    private IQueryable<Comment> Visible => db.Comments.AsNoTracking().Where(comment =>
        comment.DeletedAt == null || (comment.ParentCommentId == null && comment.Replies.Any(reply => reply.DeletedAt == null)));

    public async Task<Comment?> AddAsync(int postId, int userId, int? parentCommentId, string content)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var post = await LockPostAsync(postId);
        if (post is null) return null;
        if (parentCommentId.HasValue && !await Active.AnyAsync(parent =>
            parent.Id == parentCommentId && parent.PostId == postId && parent.ParentCommentId == null))
        {
            return null;
        }

        var comment = new Comment
        {
            PostId = postId,
            UserId = userId,
            ParentCommentId = parentCommentId,
            Content = content,
        };
        db.Comments.Add(comment);
        post.CommentCount++;
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return comment;
    }

    public Task<Comment?> FindAsync(int id) =>
        Active.AsNoTracking().SingleOrDefaultAsync(comment => comment.Id == id);

    public async Task<bool> UpdateAsync(int id, int userId, string content)
    {
        var editedAt = DateTimeOffset.UtcNow;
        return await Active.Where(comment => comment.Id == id && comment.UserId == userId)
            .ExecuteUpdateAsync(update => update
                .SetProperty(comment => comment.Content, content)
                .SetProperty(comment => comment.EditedAt, editedAt)) == 1;
    }

    public async Task<bool> DeleteAsync(Comment comment)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var post = await LockPostAsync(comment.PostId);
        if (post is null) return false;

        var deletedAt = DateTimeOffset.UtcNow;
        var deleted = await Active.Where(row => row.Id == comment.Id && row.UserId == comment.UserId)
            .ExecuteUpdateAsync(update => update
                .SetProperty(row => row.Content, "")
                .SetProperty(row => row.DeletedAt, deletedAt));
        if (deleted == 0) return false;

        post.CommentCount = Math.Max(0, post.CommentCount - 1);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    public Task<CommentDto?> GetVisibleAsync(int postId, int id) =>
        Project(Visible.Where(comment => comment.PostId == postId && comment.Id == id)).SingleOrDefaultAsync();

    public Task<List<CommentDto>> GetPageAsync(int postId, int? parentCommentId, int? beforeId, int limit) =>
        Project(Visible.Where(comment => comment.PostId == postId && comment.ParentCommentId == parentCommentId
                && (!beforeId.HasValue || comment.Id < beforeId))
            .OrderByDescending(comment => comment.Id).Take(limit)).ToListAsync();

    public Task<int> CountAsync(int postId) => Active.CountAsync(comment => comment.PostId == postId);

    // Serialize comment creation and deletion for this post before validating a reply parent.
    private Task<Post?> LockPostAsync(int postId) =>
        db.Posts.FromSqlInterpolated($"SELECT * FROM [Posts] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {postId}")
            .SingleOrDefaultAsync();

    private static IQueryable<CommentDto> Project(IQueryable<Comment> comments) =>
        comments.Select(comment => new CommentDto
        {
            Id = comment.Id,
            ParentCommentId = comment.ParentCommentId,
            IsDeleted = comment.DeletedAt != null,
            Content = comment.DeletedAt == null ? comment.Content : "",
            CreatedAt = comment.CreatedAt,
            EditedAt = comment.DeletedAt == null ? comment.EditedAt : null,
            UserId = comment.DeletedAt == null ? comment.UserId : 0,
            UserDisplayName = comment.DeletedAt == null && comment.User != null
                ? comment.User.Profile != null ? comment.User.Profile.DisplayName : "Unknown User" : "",
            UserAvatarUrl = comment.DeletedAt == null && comment.User != null && comment.User.Profile != null
                ? comment.User.Profile.AvatarUrl : null,
            ReplyCount = comment.Replies.Count(reply => reply.DeletedAt == null)
        });
}
