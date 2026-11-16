using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json.Serialization;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/likes")]
    [Authorize]
    public class LikesController : ControllerBase
    {
        private readonly ILikeService _likeService;
        private int? CurrentId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        public LikesController(ILikeService likeService)
        {
            _likeService = likeService;
        }

        [HttpPost("{postId}")]
        public async Task<IActionResult> ToggleLike(int postId)
        {
            var result = await _likeService.ToggleLikeAsync(CurrentId, postId);
            return ToActionResult(result);
        }

        [HttpPut("{postId:int}")]
        public async Task<IActionResult> SetReaction(int postId, SetReactionRequest request) =>
            ToActionResult(await _likeService.SetReactionAsync(CurrentId, postId, request.Kind));

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }

    public sealed record SetReactionRequest([property: JsonRequired] string? Kind);
}
