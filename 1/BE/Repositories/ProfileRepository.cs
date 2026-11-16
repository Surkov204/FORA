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
                    PostCount = _db.Posts.Count(post => post.UserId == userId),
                    FollowerCount = _db.UserFollows.Count(f => f.FollowingId == userId),
                    FollowingCount = _db.UserFollows.Count(f => f.FollowerId == userId)
                })
                .FirstOrDefaultAsync();
        }

        public Task<List<ProfileUserPostDto>> GetUserPostsAsync(int userId, int currentUserId)
        {
            var polls = PostPollQueries.ForViewer(_db, currentUserId);
            return _db.Posts
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new ProfileUserPostDto
                {
                    Id = p.Id,
                    UserId = p.UserId,
                    Content = p.Content,
                    CreatedAt = p.CreatedAt,
                    LikeCount = p.LikeCount,
                    CommentCount = _db.Comments.Count(comment => comment.PostId == p.Id && comment.DeletedAt == null),
                    UserDisplayName = p.User.Profile != null ? p.User.Profile.DisplayName : "User",
                    UserAvatar = p.User.Profile != null ? p.User.Profile.AvatarUrl : null,
                    IsLiked = _db.PostLikes.Any(l => l.PostId == p.Id && l.UserId == currentUserId),
                    Poll = polls.FirstOrDefault(poll => poll.PostId == p.Id),
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
