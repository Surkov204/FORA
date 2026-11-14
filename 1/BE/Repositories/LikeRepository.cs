using FORA.Data;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories
{
    public class LikeRepository : ILikeRepository
    {
        private readonly AppDbContext _db;

        public LikeRepository(AppDbContext db)
        {
            _db = db;
        }

        public Task<Post?> GetPostByIdAsync(int postId)
        {
            return _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        }

        public Task<PostLike?> GetLikeAsync(int postId, int userId)
        {
            return _db.PostLikes.FirstOrDefaultAsync(l => l.PostId == postId && l.UserId == userId);
        }

        public Task AddLikeAsync(PostLike like)
        {
            _db.PostLikes.Add(like);
            return Task.CompletedTask;
        }

        public void RemoveLike(PostLike like)
        {
            _db.PostLikes.Remove(like);
        }

        public Task SaveChangesAsync()
        {
            return _db.SaveChangesAsync();
        }
    }
}
