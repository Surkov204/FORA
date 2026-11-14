using FORA.DTOs;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/posts")]
    public class PostController : ControllerBase
    {
        private readonly IPostService _postService;

        public PostController(IPostService postService)
        {
            _postService = postService;
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostDto dto)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var userId);

            var result = await _postService.CreatePostAsync(hasUserId ? userId : null, dto);
            return ToActionResult(result);
        }

        [Authorize]
        [HttpDelete("{postId:int}")]
        public async Task<IActionResult> DeletePost(int postId)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var userId);

            var result = await _postService.DeletePostAsync(hasUserId ? userId : null, postId);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }
}
