using FORA.DTOs;
using FORA.Repositories;
using Microsoft.AspNetCore.Http;

namespace FORA.Services
{
    public class ProfileService : IProfileService
    {
        private readonly IProfileRepository _profileRepository;

        public ProfileService(IProfileRepository profileRepository)
        {
            _profileRepository = profileRepository;
        }

        public async Task<ServiceResult> GetProfileAsync(int userId)
        {
            var profile = await _profileRepository.GetProfileByUserIdAsync(userId);
            if (profile == null)
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Profile not found" });
            }

            return ServiceResult.From(StatusCodes.Status200OK, profile);
        }

        public async Task<ServiceResult> GetUserPostsAsync(int? currentUserId, int userId)
        {
            if (currentUserId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            var posts = await _profileRepository.GetUserPostsAsync(userId, currentUserId.Value);
            return ServiceResult.From(StatusCodes.Status200OK, posts);
        }

        public async Task<ServiceResult> UpdateProfileAsync(int? currentUserId, int userId, UpdateProfileDto dto)
        {
            if (currentUserId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            if (currentUserId.Value != userId)
            {
                return ServiceResult.From(StatusCodes.Status403Forbidden, new { message = "You cannot update another user's profile" });
            }

            var profile = await _profileRepository.GetUserProfileByUserIdAsync(userId);
            if (profile == null)
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Profile not found" });
            }

            profile.DisplayName = dto.DisplayName;
            profile.Bio = dto.Bio;
            profile.AvatarUrl = dto.AvatarUrl;

            await _profileRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                message = "Profile updated",
                profile.DisplayName,
                profile.Bio,
                profile.AvatarUrl
            });
        }

        public async Task<ServiceResult> UpdateAvatarUrlAsync(int? currentUserId, int userId, UpdateAvatarUrlDto dto)
        {
            if (currentUserId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            if (currentUserId.Value != userId)
            {
                return ServiceResult.From(StatusCodes.Status403Forbidden, new { message = "You cannot update another user's avatar" });
            }

            var profile = await _profileRepository.GetUserProfileByUserIdAsync(userId);
            if (profile == null)
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Profile not found" });
            }

            profile.AvatarUrl = dto.AvatarUrl;
            await _profileRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                message = "Avatar updated successfully",
                avatarUrl = profile.AvatarUrl
            });
        }
    }
}
