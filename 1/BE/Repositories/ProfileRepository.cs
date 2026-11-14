using FORA.Data;
using FORA.DTOs;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories
{
    public class ProfileRepository : IProfileRepository
    {
        private readonly AppDbContext _db;

        public ProfileRepository(AppDbContext db)
        {
            _db = db;
        }

        public Task<ProfileDto?> GetProfileByUserIdAsync(int userId)
        {
            return _db.UserProfiles
                .Where(p => p.UserId == userId)
                .Select(p => new ProfileDto
                {
                    UserId = p.UserId,
                    DisplayName = p.DisplayName,
                    Bio = p.Bio,
                    AvatarUrl = p.AvatarUrl,
                    CreatedAt = p.CreatedAt,
                    PostCount = _db.Posts.Count(post => post.UserId == userId)
                })
                .FirstOrDefaultAsync();
        }

        public Task<List<ProfileUserPostDto>> GetUserPostsAsync(int userId, int currentUserId)
        {
            return _db.Posts
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new ProfileUserPostDto
                {
                    Id = p.Id,
                    Content = p.Content,
                    CreatedAt = p.CreatedAt,
                    LikeCount = p.LikeCount,
                    CommentCount = p.CommentCount,
                    UserDisplayName = p.User.Profile != null ? p.User.Profile.DisplayName : "User",
                    UserAvatar = p.User.Profile != null ? p.User.Profile.AvatarUrl : null,
                    IsLiked = _db.PostLikes.Any(l => l.PostId == p.Id && l.UserId == currentUserId),
                    Media = _db.PostMedia
                        .Where(m => m.PostId == p.Id)
                        .OrderBy(m => m.Id)
                        .Select(m => new ProfileUserPostMediaDto
                        {
                            Url = m.Url,
                            Type = m.Type
                        })
                        .ToList()
                })
                .AsNoTracking()
                .ToListAsync();
        }

        public Task<UserProfile?> GetUserProfileByUserIdAsync(int userId)
        {
            return _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public Task SaveChangesAsync()
        {
            return _db.SaveChangesAsync();
        }
    }
}
