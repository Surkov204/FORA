using FORA.Data;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories
{
    public class PostRepository : IPostRepository
    {
        private readonly AppDbContext _db;

        public PostRepository(AppDbContext db)
        {
            _db = db;
        }

        public Task AddPostAsync(Post post)
        {
            _db.Posts.Add(post);
            return Task.CompletedTask;
        }

        public Task AddPostMediaRangeAsync(IEnumerable<PostMedia> media)
        {
            _db.PostMedia.AddRange(media);
            return Task.CompletedTask;
        }

        public Task<Post?> GetPostByIdAsync(int postId)
        {
            return _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        }

        public Task DeletePostWithRelationsAsync(Post post)
        {
            var comments = _db.Comments.Where(c => c.PostId == post.Id);
            _db.Comments.RemoveRange(comments);

            var likes = _db.PostLikes.Where(l => l.PostId == post.Id);
            _db.PostLikes.RemoveRange(likes);

            var media = _db.PostMedia.Where(m => m.PostId == post.Id);
            _db.PostMedia.RemoveRange(media);

            _db.Posts.Remove(post);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync()
        {
            return _db.SaveChangesAsync();
        }
    }
}
