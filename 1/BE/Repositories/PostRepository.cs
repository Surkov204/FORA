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

        public Task<Post?> GetPostByIdAsync(int postId)
        {
            return _db.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        }

        public Task DeletePostWithRelationsAsync(Post post)
        {
            _db.Posts.Remove(post);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync()
        {
            return _db.SaveChangesAsync();
        }
    }
}
