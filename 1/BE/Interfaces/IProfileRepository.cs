using FORA.DTOs;
using FORA.Models;

namespace FORA.Repositories
{
    public interface IProfileRepository
    {
        Task<ProfileDto?> GetProfileByUserIdAsync(int userId);
        Task<List<ProfileUserPostDto>> GetUserPostsAsync(int userId, int currentUserId);
        Task<UserProfile?> GetUserProfileByUserIdAsync(int userId);
        Task SaveChangesAsync();
    }
}
