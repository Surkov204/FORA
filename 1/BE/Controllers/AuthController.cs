using FORA.DTOs;
using FORA.Services;
using Microsoft.AspNetCore.Mvc;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            var result = await _authService.RegisterAsync(dto);
            return ToActionResult(result);
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            var result = await _authService.LoginAsync(dto);
            return ToActionResult(result);
        }

        [HttpGet("google-client-id")]
        public IActionResult GetGoogleClientId()
        {
            var result = _authService.GetGoogleClientId(
                Request.Headers.Origin.ToString(),
                Request.Headers.Referer.ToString());

            return ToActionResult(result);
        }

        [HttpGet("google-debug")]
        public IActionResult GoogleDebug()
        {
            var result = _authService.GetGoogleDebug(
                Request.Headers.Origin.ToString(),
                Request.Headers.Referer.ToString(),
                Request.Host.ToString(),
                Request.Scheme);

            return ToActionResult(result);
        }

        [HttpPost("google")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginDto dto)
        {
            var result = await _authService.GoogleLoginAsync(dto, Request.Headers.Origin.ToString());
            return ToActionResult(result);
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] int userId, [FromQuery] string token)
        {
            var result = await _authService.VerifyEmailAsync(userId, token);
            return ToActionResult(result);
        }

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
        {
            var result = await _authService.ResendVerificationAsync(dto);
            return ToActionResult(result);
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            var result = await _authService.ForgotPasswordAsync(dto);
            return ToActionResult(result);
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var result = await _authService.ResetPasswordAsync(dto);
            return ToActionResult(result);
        }

        private IActionResult ToActionResult(ServiceResult result)
        {
            return StatusCode(result.StatusCode, result.Data);
        }
    }
}
