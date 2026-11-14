using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/likes")]
    [Authorize]
    public class LikesController : ControllerBase
    {
        private readonly ILikeService _likeService;

        public LikesController(ILikeService likeService)
        {
            _likeService = likeService;
        }

        [HttpPost("{postId}")]
        public async Task<IActionResult> ToggleLike(int postId)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var userId);

            var result = await _likeService.ToggleLikeAsync(hasUserId ? userId : null, postId);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }
}
