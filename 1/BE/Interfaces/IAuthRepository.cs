using FORA.Models;

namespace FORA.Repositories
{
    public interface IAuthRepository
    {
        Task<bool> AnyUserByEmailAsync(string email);
        Task<User?> GetUserByEmailAsync(string email);
        Task<User?> GetUserByEmailWithProfileAsync(string email);
        Task<User?> GetUserByIdAsync(int userId);
        Task AddUserAsync(User user);
        Task AddUserProfileAsync(UserProfile profile);
        Task SaveChangesAsync();
    }
}
