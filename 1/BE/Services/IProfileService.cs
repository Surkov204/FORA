using FORA.DTOs;

namespace FORA.Services
{
    public interface IProfileService
    {
        Task<ServiceResult> GetProfileAsync(int userId);
        Task<ServiceResult> GetUserPostsAsync(int? currentUserId, int userId);
        Task<ServiceResult> UpdateProfileAsync(int? currentUserId, int userId, UpdateProfileDto dto);
        Task<ServiceResult> UpdateAvatarUrlAsync(int? currentUserId, int userId, UpdateAvatarUrlDto dto);
    }
}
