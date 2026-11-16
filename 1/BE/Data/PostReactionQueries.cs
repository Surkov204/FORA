using FORA.DTOs;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Data;

internal static class PostReactionQueries
{
    public static IQueryable<PostReactionRow> ForViewer(AppDbContext db, int userId) =>
        db.Posts.AsNoTracking().Select(post => new PostReactionRow
        {
            PostId = post.Id,
            Summary = new PostReactionsDto
            {
                Like = db.PostLikes.Count(row => row.PostId == post.Id && row.Kind == PostLike.Like),
                Helpful = db.PostLikes.Count(row => row.PostId == post.Id && row.Kind == PostLike.Helpful),
                Funny = db.PostLikes.Count(row => row.PostId == post.Id && row.Kind == PostLike.Funny),
                Celebrate = db.PostLikes.Count(row => row.PostId == post.Id && row.Kind == PostLike.Celebrate),
                MyReaction = db.PostLikes.Where(row => row.PostId == post.Id && row.UserId == userId)
                    .Select(row => row.Kind).FirstOrDefault()
            }
        });

    internal sealed class PostReactionRow
    {
        public int PostId { get; init; }
        public required PostReactionsDto Summary { get; init; }
    }
}
