using Microsoft.AspNetCore.Mvc;
using FORA.Data;
using FORA.Models;
using FORA.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/posts")]
    public class PostController : ControllerBase
    {
        private readonly AppDbContext _db;

        public PostController(AppDbContext db)
        {
            _db = db;
        }

        // POST /api/posts
        [Authorize]
        [HttpPost]
        public IActionResult CreatePost(CreatePostDto dto)
        {
            var userId = int.Parse(
                User.FindFirstValue(ClaimTypes.NameIdentifier)!
            );

            var post = new Post
            {
                UserId = userId,
                Content = dto.Content,
                CreatedAt = DateTime.UtcNow
            };

            _db.Posts.Add(post);
            _db.SaveChanges();

            return Ok(new
            {
                post.Id,
                post.Content,
                post.CreatedAt
            });
        }

    }
}
