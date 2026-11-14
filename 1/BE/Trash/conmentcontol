using FORA.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[Route("api/[controller]")]
[ApiController]
public class CommentsController : ControllerBase
{
    private readonly ICommentService _commentService;

    public CommentsController(ICommentService commentService)
    {
        _commentService = commentService;
    }

    // POST: api/comments
    [HttpPost]
    [Authorize] // Yêu cầu phải đăng nhập mới được comment
    public async Task<IActionResult> CreateComment([FromBody] CreateCommentDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            // Lấy UserId từ Token (JWT)
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim == null) return Unauthorized();

            int userId = int.Parse(userIdClaim.Value);

            var result = await _commentService.AddCommentAsync(userId, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // GET: api/comments/post/5
    [HttpGet("post/{postId}")]
    public async Task<IActionResult> GetCommentsByPost(int postId)
    {
        try
        {
            var comments = await _commentService.GetCommentsByPostIdAsync(postId);
            return Ok(comments);
        }
        catch (Exception ex)
        {
            Console.WriteLine("GG: " + ex);
            return StatusCode(500, ex.Message);
        }
    }

}