using FORA.Data;
using FORA.DTOs;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories;

public sealed class LikeRepository(AppDbContext db) : ILikeRepository
{
    public async Task<PostReactionsDto?> ChangeReactionAsync(int postId, int userId, string? kind, bool toggleLike)
    {
        await using var transaction = await db.Database.BeginTransactionAsync();
        var post = await db.LockPostAsync(postId);
        if (post is null) return null;

        var reaction = await db.PostLikes.FindAsync(userId, postId);
        var previous = reaction?.Kind;
        var next = toggleLike ? (previous == PostLike.Like ? null : PostLike.Like) : kind;
        if (previous != next)
        {
            if (next is null)
                db.PostLikes.Remove(reaction!);
            else if (reaction is null)
                db.PostLikes.Add(new PostLike { UserId = userId, PostId = postId, Kind = next });
            else
                reaction.Kind = next;

            var delta = (next == PostLike.Like ? 1 : 0) - (previous == PostLike.Like ? 1 : 0);
            post.LikeCount = Math.Max(0, post.LikeCount + delta);
            await db.SaveChangesAsync();
        }

        var summary = await PostReactionQueries.ForViewer(db, userId).Where(row => row.PostId == postId)
            .Select(row => row.Summary).SingleAsync();
        await transaction.CommitAsync();
        return summary;
    }
}
