using FORA.DTOs;

namespace FORA.Services
{
    public interface IAuthService
    {
        Task<ServiceResult> RegisterAsync(RegisterDto dto);
        Task<ServiceResult> LoginAsync(LoginDto dto);
        ServiceResult GetGoogleClientId(string originHeader, string refererHeader);
        ServiceResult GetGoogleDebug(string originHeader, string refererHeader, string host, string scheme);
        Task<ServiceResult> GoogleLoginAsync(GoogleLoginDto dto, string originHeader);
        Task<ServiceResult> VerifyEmailAsync(int userId, string token);
        Task<ServiceResult> ResendVerificationAsync(ResendVerificationDto dto);
        Task<ServiceResult> ForgotPasswordAsync(ForgotPasswordDto dto);
        Task<ServiceResult> ResetPasswordAsync(ResetPasswordDto dto);
    }
}
