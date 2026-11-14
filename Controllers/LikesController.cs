using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using FORA.Data;
using FORA.Models;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/likes")]
    [Authorize]
    public class LikesController : ControllerBase
    {
        private readonly AppDbContext _db;

        public LikesController(AppDbContext db)
        {
            _db = db;
        }

        // POST: api/likes/{postId}
        [HttpPost("{postId}")]
        public IActionResult ToggleLike(int postId)
        {
            var userId = int.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!
            );

            var post = _db.Posts.FirstOrDefault(p => p.Id == postId);
            if (post == null)
                return NotFound("Post not found");

            var like = _db.PostLikes
                .FirstOrDefault(l => l.PostId == postId && l.UserId == userId);

            bool isLiked;

            if (like == null)
            {
                // 👍 Like
                _db.PostLikes.Add(new PostLike
                {
                    PostId = postId,
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow
                });

                post.LikeCount++;
                isLiked = true;
            }
            else
            {
                // 👎 Unlike
                _db.PostLikes.Remove(like);
                post.LikeCount--;
                isLiked = false;
            }

            _db.SaveChanges();

            return Ok(new
            {
                isLiked,
                likeCount = post.LikeCount
            });
        }
    }
}
