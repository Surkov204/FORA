using FORA.DTOs;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/profile")]
    public class ProfileController : ControllerBase
    {
        private readonly IProfileService _profileService;

        public ProfileController(IProfileService profileService)
        {
            _profileService = profileService;
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetProfile(int userId)
        {
            var result = await _profileService.GetProfileAsync(userId);
            return ToActionResult(result);
        }

        [Authorize]
        [HttpGet("{userId}/posts")]
        public async Task<IActionResult> GetUserPosts(int userId)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var currentUserId);

            var result = await _profileService.GetUserPostsAsync(hasUserId ? currentUserId : null, userId);
            return ToActionResult(result);
        }

        [Authorize]
        [HttpPut("{userId}")]
        public async Task<IActionResult> UpdateProfile(int userId, [FromBody] UpdateProfileDto dto)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var currentUserId);

            var result = await _profileService.UpdateProfileAsync(hasUserId ? currentUserId : null, userId, dto);
            return ToActionResult(result);
        }

        [Authorize]
        [HttpPut("{userId}/avatar-url")]
        public async Task<IActionResult> UpdateAvatarUrl(int userId, [FromBody] UpdateAvatarUrlDto dto)
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var hasUserId = int.TryParse(userIdClaim, out var currentUserId);

            var result = await _profileService.UpdateAvatarUrlAsync(hasUserId ? currentUserId : null, userId, dto);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }
}
