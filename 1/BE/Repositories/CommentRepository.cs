using FORA.Data;
using FORA.DTOs;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories
{
    public class CommentRepository : ICommentRepository
    {
        private readonly AppDbContext _context;

        public CommentRepository(AppDbContext context)
        {
            _context = context;
        }

        public Task<Post?> GetPostByIdAsync(int postId)
        {
            return _context.Posts.FirstOrDefaultAsync(p => p.Id == postId);
        }

        public async Task<Comment> AddCommentWithPostCountAsync(Post post, int userId, string content)
        {
            var comment = new Comment
            {
                PostId = post.Id,
                UserId = userId,
                Content = content,
                CreatedAt = DateTime.UtcNow
            };

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                _context.Comments.Add(comment);
                post.CommentCount += 1;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }

            return comment;
        }

        public Task<UserProfile?> GetUserProfileByUserIdAsync(int userId)
        {
            return _context.UserProfiles.FirstOrDefaultAsync(u => u.UserId == userId);
        }

        public Task<List<CommentDto>> GetCommentsByPostIdAsync(int postId)
        {
            return _context.Comments
                .Where(c => c.PostId == postId)
                .Include(c => c.User)
                    .ThenInclude(u => u.Profile)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new CommentDto
                {
                    Id = c.Id,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt,
                    UserId = c.UserId,
                    UserDisplayName = c.User.Profile != null ? c.User.Profile.DisplayName : "Unknown User",
                    UserAvatarUrl = c.User.Profile != null ? c.User.Profile.AvatarUrl : null
                })
                .AsNoTracking()
                .ToListAsync();
        }
    }
}
