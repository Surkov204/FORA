using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Data;

internal static class PostWriteQueries
{
    // Call within a transaction so comment and answer changes on this post are serialized.
    public static Task<Post?> LockPostAsync(this AppDbContext db, int postId) =>
        db.Posts.FromSqlInterpolated($"SELECT * FROM [Posts] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {postId}")
            .SingleOrDefaultAsync();
}
