using FORA.DTOs;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FORA.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommentsController : ControllerBase
    {
        private readonly ICommentService _commentService;

        public CommentsController(ICommentService commentService)
        {
            _commentService = commentService;
        }

        [HttpPost]
        [Authorize]
        public async Task<IActionResult> CreateComment([FromBody] CreateCommentDto request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim?.Value, out var userId);

            var result = await _commentService.AddCommentAsync(hasUserId ? userId : null, request);
            return ToActionResult(result);
        }

        [HttpGet("post/{postId}")]
        public async Task<IActionResult> GetCommentsByPost(int postId)
        {
            var result = await _commentService.GetCommentsByPostIdAsync(postId);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }
}
