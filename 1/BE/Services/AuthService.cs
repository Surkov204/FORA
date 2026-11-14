using FORA.DTOs;
using FORA.Models;
using FORA.Repositories;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace FORA.Services
{
    public class AuthService : IAuthService
    {
        private readonly IAuthRepository _authRepository;
        private readonly IConfiguration _configuration;
        private readonly IEmailSender _emailSender;

        public AuthService(IAuthRepository authRepository, IConfiguration configuration, IEmailSender emailSender)
        {
            _authRepository = authRepository;
            _configuration = configuration;
            _emailSender = emailSender;
        }

        public async Task<ServiceResult> RegisterAsync(RegisterDto dto)
        {
            var email = NormalizeEmail(dto.Email);
            var exists = await _authRepository.AnyUserByEmailAsync(email);
            if (exists)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, "Email da duoc su dung");
            }

            var user = new User
            {
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = false
            };

            var (rawToken, tokenHash) = GenerateRandomToken();
            user.EmailVerificationTokenHash = tokenHash;
            user.EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24);

            await _authRepository.AddUserAsync(user);
            await _authRepository.SaveChangesAsync();

            var profile = new UserProfile
            {
                UserId = user.Id,
                DisplayName = "New User",
                AvatarUrl = "https://i.pinimg.com/736x/01/6c/6f/016c6fd3571087621dc810ecfad542a9.jpg",
                Bio = "TEST",
                CreatedAt = DateTime.UtcNow
            };

            await _authRepository.AddUserProfileAsync(profile);
            await _authRepository.SaveChangesAsync();

            var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
            var verifyUrl = $"{feBase}/verify-email?userId={user.Id}&token={rawToken}";

            Console.WriteLine("======================================");
            Console.WriteLine("REGISTER OK - Preparing verify email");
            Console.WriteLine($"To: {user.Email}");
            Console.WriteLine($"VerifyUrl: {verifyUrl}");

            try
            {
                await _emailSender.SendVerifyEmailAsync(user.Email, verifyUrl);
                Console.WriteLine("SEND MAIL SUCCESS");
            }
            catch (Exception ex)
            {
                Console.WriteLine("SEND MAIL FAILED");
                Console.WriteLine(ex);
            }

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                message = "Dang ky thanh cong. Vui long kiem tra email de xac thuc tai khoan.",
                emailVerificationRequired = true,
                dev = new { verifyUrl },
                user = new { id = user.Id, email = user.Email }
            });
        }

        public async Task<ServiceResult> LoginAsync(LoginDto dto)
        {
            var email = NormalizeEmail(dto.Email);
            var user = await _authRepository.GetUserByEmailWithProfileAsync(email);

            if (user == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, "Email hoac mat khau khong dung");
            }

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, "Email hoac mat khau khong dung");
            }

            if (!user.IsEmailVerified)
            {
                return ServiceResult.From(StatusCodes.Status403Forbidden, new
                {
                    message = "Email chua duoc xac thuc",
                    code = "EMAIL_NOT_VERIFIED"
                });
            }

            user.LastLoginAt = DateTime.UtcNow;
            await _authRepository.SaveChangesAsync();

            var tokenString = GenerateJwtToken(user);

            return ServiceResult.From(StatusCodes.Status200OK, new
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

        public ServiceResult GetGoogleClientId(string originHeader, string refererHeader)
        {
            var clientId = _configuration["GoogleAuth:ClientId"];
            var origin = NormalizeOrigin(originHeader);
            var configuredOrigins = GetConfiguredGoogleOrigins();
            var originAllowed = IsOriginAllowed(origin, configuredOrigins);

            Console.WriteLine($"[GOOGLE_DEBUG] GET google-client-id origin={origin} originAllowed={originAllowed} referer={refererHeader} clientId={clientId}");

            if (string.IsNullOrWhiteSpace(clientId))
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Google login chua duoc cau hinh" });
            }

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                clientId,
                origin,
                originAllowed,
                configuredOrigins
            });
        }

        public ServiceResult GetGoogleDebug(string originHeader, string refererHeader, string host, string scheme)
        {
            var clientId = _configuration["GoogleAuth:ClientId"];
            var origin = NormalizeOrigin(originHeader);
            var configuredOrigins = GetConfiguredGoogleOrigins();
            var originAllowed = IsOriginAllowed(origin, configuredOrigins);

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                clientId,
                origin,
                referer = refererHeader,
                host,
                scheme,
                originAllowed,
                configuredOrigins,
                timeUtc = DateTime.UtcNow
            });
        }

        public async Task<ServiceResult> GoogleLoginAsync(GoogleLoginDto dto, string originHeader)
        {
            Console.WriteLine($"[GOOGLE_DEBUG] POST google idTokenLength={dto?.IdToken?.Length ?? 0} origin={originHeader}");

            if (dto == null || string.IsNullOrWhiteSpace(dto.IdToken))
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Thieu idToken" });
            }

            var configuredClientId = _configuration["GoogleAuth:ClientId"];
            if (string.IsNullOrWhiteSpace(configuredClientId))
            {
                return ServiceResult.From(StatusCodes.Status500InternalServerError, new
                {
                    message = "Google login chua duoc cau hinh tren server"
                });
            }

            GoogleJsonWebSignature.Payload payload;
            try
            {
                payload = await GoogleJsonWebSignature.ValidateAsync(dto.IdToken, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = new[] { configuredClientId }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GOOGLE_DEBUG] Google token validate failed: {ex.Message}");
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new
                {
                    message = "Google token khong hop le",
                    detail = ex.Message
                });
            }

            var email = NormalizeEmail(payload.Email);
            if (string.IsNullOrWhiteSpace(email))
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Khong lay duoc email tu Google token" });
            }

            var user = await _authRepository.GetUserByEmailWithProfileAsync(email);
            var autoRegistered = false;

            if (user == null)
            {
                autoRegistered = true;
                user = new User
                {
                    Email = email,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                    CreatedAt = DateTime.UtcNow,
                    LastLoginAt = DateTime.UtcNow,
                    IsEmailVerified = true,
                    EmailVerificationTokenHash = null,
                    EmailVerificationExpiresAt = null
                };

                await _authRepository.AddUserAsync(user);
                await _authRepository.SaveChangesAsync();

                var fallbackDisplayName = email.Split('@')[0];
                var profile = new UserProfile
                {
                    UserId = user.Id,
                    DisplayName = string.IsNullOrWhiteSpace(payload.Name) ? fallbackDisplayName : payload.Name,
                    AvatarUrl = string.IsNullOrWhiteSpace(payload.Picture)
                        ? "https://i.pinimg.com/736x/01/6c/6f/016c6fd3571087621dc810ecfad542a9.jpg"
                        : payload.Picture,
                    Bio = "",
                    CreatedAt = DateTime.UtcNow
                };

                await _authRepository.AddUserProfileAsync(profile);
                await _authRepository.SaveChangesAsync();

                user.Profile = profile;
            }
            else
            {
                user.LastLoginAt = DateTime.UtcNow;

                if (!user.IsEmailVerified)
                {
                    user.IsEmailVerified = true;
                    user.EmailVerificationTokenHash = null;
                    user.EmailVerificationExpiresAt = null;
                }

                if (user.Profile == null)
                {
                    var fallbackDisplayName = email.Split('@')[0];
                    var profile = new UserProfile
                    {
                        UserId = user.Id,
                        DisplayName = string.IsNullOrWhiteSpace(payload.Name) ? fallbackDisplayName : payload.Name,
                        AvatarUrl = string.IsNullOrWhiteSpace(payload.Picture)
                            ? "https://i.pinimg.com/736x/01/6c/6f/016c6fd3571087621dc810ecfad542a9.jpg"
                            : payload.Picture,
                        Bio = "",
                        CreatedAt = DateTime.UtcNow
                    };

                    await _authRepository.AddUserProfileAsync(profile);
                    user.Profile = profile;
                }

                await _authRepository.SaveChangesAsync();
            }

            var tokenString = GenerateJwtToken(user);

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                token = tokenString,
                autoRegistered,
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    displayName = user.Profile?.DisplayName ?? "User",
                    avatarUrl = user.Profile?.AvatarUrl ?? "https://i.imgur.com/6VBx3io.png"
                }
            });
        }

        public async Task<ServiceResult> VerifyEmailAsync(int userId, string token)
        {
            var user = await _authRepository.GetUserByIdAsync(userId);
            Console.WriteLine($"VERIFY CALLED userId={userId}");

            if (user == null)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "User khong ton tai" });
            }

            if (user.IsEmailVerified)
            {
                return ServiceResult.From(StatusCodes.Status200OK, new
                {
                    message = "Email da duoc xac thuc truoc do",
                    server = Environment.MachineName,
                    time = DateTime.UtcNow
                });
            }

            if (user.EmailVerificationExpiresAt == null || user.EmailVerificationExpiresAt < DateTime.UtcNow)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new
                {
                    message = "Token da het han",
                    code = "TOKEN_EXPIRED"
                });
            }

            var tokenHash = Sha256Base64Url(token);
            if (user.EmailVerificationTokenHash == null || user.EmailVerificationTokenHash != tokenHash)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new
                {
                    message = "Token khong hop le",
                    code = "INVALID_TOKEN"
                });
            }

            user.IsEmailVerified = true;
            user.EmailVerificationTokenHash = null;
            user.EmailVerificationExpiresAt = null;
            await _authRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new { message = "Xac thuc email thanh cong" });
        }

        public async Task<ServiceResult> ResendVerificationAsync(ResendVerificationDto dto)
        {
            var email = NormalizeEmail(dto.Email);
            var user = await _authRepository.GetUserByEmailAsync(email);

            if (user == null)
            {
                return ServiceResult.From(StatusCodes.Status200OK, new
                {
                    message = "Neu email ton tai, he thong da gui lai link xac thuc."
                });
            }

            if (user.IsEmailVerified)
            {
                return ServiceResult.From(StatusCodes.Status200OK, new { message = "Email da duoc xac thuc." });
            }

            var (rawToken, tokenHash) = GenerateRandomToken();
            user.EmailVerificationTokenHash = tokenHash;
            user.EmailVerificationExpiresAt = DateTime.UtcNow.AddHours(24);
            await _authRepository.SaveChangesAsync();

            var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
            var verifyUrl = $"{feBase}/verify-email?userId={user.Id}&token={rawToken}";

            Console.WriteLine("======================================");
            Console.WriteLine("RESEND - Preparing verify email");
            Console.WriteLine($"To: {user.Email}");
            Console.WriteLine($"VerifyUrl: {verifyUrl}");

            try
            {
                await _emailSender.SendVerifyEmailAsync(user.Email, verifyUrl);
                Console.WriteLine("RESEND MAIL SUCCESS");
            }
            catch (Exception ex)
            {
                Console.WriteLine("RESEND MAIL FAILED");
                Console.WriteLine(ex);
            }

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                message = "Da gui lai email xac thuc. Vui long kiem tra inbox/spam.",
                dev = new { verifyUrl }
            });
        }

        public async Task<ServiceResult> ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            var email = NormalizeEmail(dto.Email);
            var user = await _authRepository.GetUserByEmailAsync(email);

            if (user == null)
            {
                return ServiceResult.From(StatusCodes.Status200OK, new
                {
                    message = "Neu email ton tai, he thong da gui link dat lai mat khau."
                });
            }

            var (rawToken, tokenHash) = GenerateRandomToken();
            user.PasswordResetTokenHash = tokenHash;
            user.PasswordResetExpiresAt = DateTime.UtcNow.AddMinutes(30);
            await _authRepository.SaveChangesAsync();

            var feBase = _configuration["App:FrontendBaseUrl"]?.TrimEnd('/');
            var resetUrl = $"{feBase}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={rawToken}";

            Console.WriteLine("======================================");
            Console.WriteLine("FORGOT PASSWORD - Preparing reset email");
            Console.WriteLine($"To: {user.Email}");
            Console.WriteLine($"ResetUrl: {resetUrl}");

            try
            {
                await _emailSender.SendResetPasswordEmailAsync(user.Email, resetUrl);
                Console.WriteLine("RESET MAIL SUCCESS");
            }
            catch (Exception ex)
            {
                Console.WriteLine("RESET MAIL FAILED");
                Console.WriteLine(ex);
            }

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                message = "Neu email ton tai, he thong da gui link dat lai mat khau.",
                dev = new { resetUrl }
            });
        }

        public async Task<ServiceResult> ResetPasswordAsync(ResetPasswordDto dto)
        {
            var email = NormalizeEmail(dto.Email);
            var user = await _authRepository.GetUserByEmailAsync(email);

            if (user == null)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Email khong ton tai" });
            }

            if (user.PasswordResetExpiresAt == null || user.PasswordResetExpiresAt < DateTime.UtcNow)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new
                {
                    message = "Token da het han",
                    code = "TOKEN_EXPIRED"
                });
            }

            var tokenHash = Sha256Base64Url(dto.Token);
            if (user.PasswordResetTokenHash == null || user.PasswordResetTokenHash != tokenHash)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new
                {
                    message = "Token khong hop le",
                    code = "INVALID_TOKEN"
                });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.PasswordResetTokenHash = null;
            user.PasswordResetExpiresAt = null;
            await _authRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new { message = "Doi mat khau thanh cong" });
        }

        private string[] GetConfiguredGoogleOrigins()
        {
            var explicitOrigins = _configuration.GetSection("GoogleAuth:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
            var frontendOrigin = NormalizeOrigin(_configuration["App:FrontendBaseUrl"]);

            return explicitOrigins
                .Select(NormalizeOrigin)
                .Concat(new[] { frontendOrigin })
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private string GenerateJwtToken(User user)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, "USER")
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"] ?? string.Empty));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var expireDays = 7d;
            var configuredExpireDays = _configuration["Jwt:ExpireDays"];
            if (!string.IsNullOrWhiteSpace(configuredExpireDays) && double.TryParse(configuredExpireDays, out var parsed))
            {
                expireDays = parsed;
            }

            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(expireDays),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private static string NormalizeEmail(string? email)
        {
            return (email ?? string.Empty).Trim().ToLowerInvariant();
        }

        private static string NormalizeOrigin(string? originOrUrl)
        {
            if (string.IsNullOrWhiteSpace(originOrUrl))
            {
                return string.Empty;
            }

            var raw = originOrUrl.Trim();
            if (Uri.TryCreate(raw, UriKind.Absolute, out var absolute))
            {
                return absolute.GetLeftPart(UriPartial.Authority).TrimEnd('/');
            }

            return raw.TrimEnd('/');
        }

        private static bool IsOriginAllowed(string requestOrigin, IEnumerable<string> configuredOrigins)
        {
            if (string.IsNullOrWhiteSpace(requestOrigin))
            {
                return false;
            }

            return configuredOrigins.Any(origin =>
                string.Equals(origin, requestOrigin, StringComparison.OrdinalIgnoreCase));
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
}
