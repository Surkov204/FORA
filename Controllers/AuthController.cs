using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FORA.Data;
using FORA.DTOs;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FORA.Models;
using FORA.Services;

namespace FORA.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _configuration;

        private readonly IEmailSender _email;

        public AuthController(AppDbContext db, IConfiguration configuration, IEmailSender email)
        {
            _db = db;
            _configuration = configuration;
            _email = email;
        }


        // POST: api/auth/register
        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            var exists = await _db.Users.AnyAsync(u => u.Email == dto.Email);
            if (exists)
                return BadRequest("Email đã được sử dụng");

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var user = new User
            {
                Email = dto.Email,
                PasswordHash = passwordHash,
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = false
            };

            // Create email verification token
            var (rawToken, tokenHash) = GenerateRandomToken();
            user.EmailVerificationTokenHash = tokenHash;
            user.EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24);

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            var profile = new UserProfile
            {
                UserId = user.Id,
                DisplayName = "New User",
                AvatarUrl = "https://i.pinimg.com/736x/01/6c/6f/016c6fd3571087621dc810ecfad542a9.jpg",
                Bio = "TEST",
                CreatedAt = DateTime.UtcNow
            };

            _db.UserProfiles.Add(profile);
            await _db.SaveChangesAsync();

            // TODO: Production: send verify email here
            // ✅ gửi link về FRONTEND (cách 2)
            var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
            var verifyUrl = $"{feBase}/verify-email?userId={user.Id}&token={rawToken}";

            Console.WriteLine("======================================");
            Console.WriteLine("✅ REGISTER OK - Preparing verify email");
            Console.WriteLine($"📧 To: {user.Email}");
            Console.WriteLine($"🔗 VerifyUrl: {verifyUrl}");

            try
            {
                await _email.SendVerifyEmailAsync(user.Email, verifyUrl);
                Console.WriteLine("✅ SEND MAIL SUCCESS");
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ SEND MAIL FAILED");
                Console.WriteLine(ex.ToString());
                // Tuỳ bạn: muốn fail luôn thì return StatusCode(500,...)
                // return StatusCode(500, new { message = "Gửi email xác thực thất bại", detail = ex.Message });
            }

            return Ok(new
            {
                message = "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
                emailVerificationRequired = true,
                dev = new { verifyUrl },
                user = new { id = user.Id, email = user.Email }
            });

        }

        // POST: api/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            var user = await _db.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Email == dto.Email);

            if (user == null)
                return Unauthorized("Email hoặc mật khẩu không đúng");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                return Unauthorized("Email hoặc mật khẩu không đúng");

            if (!user.IsEmailVerified)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Email chưa được xác thực", code = "EMAIL_NOT_VERIFIED" });

            user.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var tokenString = GenerateJwtToken(user);

            return Ok(new
            {
                token = tokenString,
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    displayName = user.Profile?.DisplayName ?? "User",
                    avatarUrl = user.Profile?.AvatarUrl ?? "https://i.imgur.com/6VBx3io.png"
                }
            });
        }

        // GET: api/auth/verify-email?userId=1&token=...
        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] int userId, [FromQuery] string token)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            Console.WriteLine($"VERIFY CALLED userId={userId}");
            if (user == null) return BadRequest(new { message = "User không tồn tại" });

            if (user.IsEmailVerified) return Ok(new { message = "Email đã được xác thực trước đó", server = Environment.MachineName, time = DateTime.UtcNow });

            if (user.EmailVerificationExpiresAt == null || user.EmailVerificationExpiresAt < DateTime.UtcNow)
                return BadRequest(new { message = "Token đã hết hạn", code = "TOKEN_EXPIRED" });

            var tokenHash = Sha256Base64Url(token);
            if (user.EmailVerificationTokenHash == null || user.EmailVerificationTokenHash != tokenHash)
                return BadRequest(new { message = "Token không hợp lệ", code = "INVALID_TOKEN" });

            user.IsEmailVerified = true;
            user.EmailVerificationTokenHash = null;
            user.EmailVerificationExpiresAt = null;
            await _db.SaveChangesAsync();

            return Ok(new { message = "Xác thực email thành công" });
        }

        // POST: api/auth/resend-verification
        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null) return Ok(new { message = "Nếu email tồn tại, hệ thống đã gửi lại link xác thực." });
            if (user.IsEmailVerified) return Ok(new { message = "Email đã được xác thực." });

            var (rawToken, tokenHash) = GenerateRandomToken();
            user.EmailVerificationTokenHash = tokenHash;
            user.EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24);
            await _db.SaveChangesAsync();

            var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
            var verifyUrl = $"{feBase}/verify-email?userId={user.Id}&token={rawToken}";

            Console.WriteLine("======================================");
            Console.WriteLine("✅ RESEND - Preparing verify email");
            Console.WriteLine($"📧 To: {user.Email}");
            Console.WriteLine($"🔗 VerifyUrl: {verifyUrl}");

            try
            {
                await _email.SendVerifyEmailAsync(user.Email, verifyUrl);
                Console.WriteLine("✅ RESEND MAIL SUCCESS");
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌ RESEND MAIL FAILED");
                Console.WriteLine(ex.ToString());
            }

            return Ok(new
            {
                message = "Đã gửi lại email xác thực. Vui lòng kiểm tra inbox/spam.",
                dev = new { verifyUrl }
            });

        }

        private string GenerateJwtToken(User user)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, "USER")
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(double.Parse(_configuration["Jwt:ExpireDays"])),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }


[HttpPost("reset-password")]
public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
{
    var email = dto.Email.Trim().ToLower();
    var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

    if (user == null) return BadRequest(new { message = "Email không tồn tại" });

    if (user.PasswordResetExpiresAt == null || user.PasswordResetExpiresAt < DateTime.UtcNow)
        return BadRequest(new { message = "Token đã hết hạn", code = "TOKEN_EXPIRED" });

    var tokenHash = Sha256Base64Url(dto.Token);
    if (user.PasswordResetTokenHash == null || user.PasswordResetTokenHash != tokenHash)
        return BadRequest(new { message = "Token không hợp lệ", code = "INVALID_TOKEN" });

    // ✅ update password
    user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

    // ✅ clear token
    user.PasswordResetTokenHash = null;
    user.PasswordResetExpiresAt = null;

    await _db.SaveChangesAsync();

    return Ok(new { message = "Đổi mật khẩu thành công ✅" });
}



        [HttpPost("forgot-password")]
public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
{
    var email = dto.Email.Trim().ToLower();
    var user = await _db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

    // ✅ luôn trả OK để tránh leak email có tồn tại hay không
    if (user == null)
        return Ok(new { message = "Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu." });

    var (rawToken, tokenHash) = GenerateRandomToken();
    user.PasswordResetTokenHash = tokenHash;
    user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);
    await _db.SaveChangesAsync();

    var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
    var resetUrl = $"{feBase}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={rawToken}";

    Console.WriteLine("======================================");
    Console.WriteLine("✅ FORGOT PASSWORD - Preparing reset email");
    Console.WriteLine($"📧 To: {user.Email}");
    Console.WriteLine($"🔗 ResetUrl: {resetUrl}");

    try
    {
        // m có thể tạo hàm mới SendResetPasswordEmailAsync
        await _email.SendResetPasswordEmailAsync(user.Email, resetUrl);
        Console.WriteLine("✅ RESET MAIL SUCCESS");
    }
    catch (Exception ex)
    {
        Console.WriteLine("❌ RESET MAIL FAILED");
        Console.WriteLine(ex.ToString());
    }

    return Ok(new
    {
        message = "Nếu email tồn tại, hệ thống đã gửi link đặt lại mật khẩu.",
        dev = new { resetUrl }
    });
}


        private static (string rawToken, string tokenHash) GenerateRandomToken()
        {
            var bytes = RandomNumberGenerator.GetBytes(32);
            var raw = Base64UrlEncode(bytes);
            var hash = Sha256Base64Url(raw);
            return (raw, hash);
        }

        private static string Sha256Base64Url(string input)
        {
            var bytes = Encoding.UTF8.GetBytes(input);
            var hash = SHA256.HashData(bytes);
            return Base64UrlEncode(hash);
        }

        private static string Base64UrlEncode(byte[] bytes)
        {
            return Convert.ToBase64String(bytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
        }
    }

    public class ResendVerificationDto
    {
        public string Email { get; set; } = string.Empty;
    }
}
