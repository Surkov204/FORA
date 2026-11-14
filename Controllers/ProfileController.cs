using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FORA.Data;
using FORA.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/profile")]
    public class ProfileController : ControllerBase
    {
        private readonly AppDbContext _db;

        public ProfileController(AppDbContext db)
        {
            _db = db;
        }

        // GET /api/profile/{userId}
        [HttpGet("{userId}")]
        public IActionResult GetProfile(int userId)
        {
            var profile = _db.UserProfiles
                .Include(p => p.User)
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
                .FirstOrDefault();

            if (profile == null)
                return NotFound("Profile not found");

            return Ok(profile);
        }

        // GET /api/profile/{userId}/posts
        [Authorize]
        [HttpGet("{userId}/posts")]
        public IActionResult GetUserPosts(int userId)
        {
            var currentUserId = int.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!
            );

            var posts = _db.Posts
                .Where(p => p.UserId == userId)
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new
                {
                    p.Id,
                    p.Content,
                    p.CreatedAt,
                    p.LikeCount,
                    p.CommentCount,

              
            userDisplayName = p.User.Profile.DisplayName,
            userAvatar = p.User.Profile.AvatarUrl,

                    isLiked = _db.PostLikes.Any(
                        l => l.PostId == p.Id && l.UserId == currentUserId
                    )
                })
                .ToList();

            return Ok(posts);
        }


        // ✅ PUT /api/profile/{userId}
        [HttpPut("{userId}")]
        public IActionResult UpdateProfile(int userId, UpdateProfileDto dto)
        {
            var profile = _db.UserProfiles
                .FirstOrDefault(p => p.UserId == userId);

            if (profile == null)
                return NotFound("Profile not found");

            profile.DisplayName = dto.DisplayName;
            profile.Bio = dto.Bio;
            profile.AvatarUrl = dto.AvatarUrl;

            _db.SaveChanges();

            return Ok(new
            {
                message = "Profile updated",
                profile.DisplayName,
                profile.Bio,
                profile.AvatarUrl
            });
        }

        [Authorize]
        [HttpPost("{userId}/avatar")]
        public async Task<IActionResult> UploadAvatar(
    int userId,
    IFormFile avatar
)
        {
            if (avatar == null || avatar.Length == 0)
                return BadRequest("No file");

            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(avatar.FileName)}";
            var path = Path.Combine("wwwroot/avatars", fileName);

            using var stream = new FileStream(path, FileMode.Create);
            await avatar.CopyToAsync(stream);

            var avatarUrl = $"/avatars/{fileName}";

            var profile = _db.UserProfiles.FirstOrDefault(p => p.UserId == userId);
            profile.AvatarUrl = avatarUrl;
            _db.SaveChanges();

            return Ok(new { avatarUrl });
        }

    }
}
