using FORA.Data;
using FORA.Models;
using Microsoft.EntityFrameworkCore;

namespace FORA.Repositories
{
    public class AuthRepository : IAuthRepository
    {
        private readonly AppDbContext _db;

        public AuthRepository(AppDbContext db)
        {
            _db = db;
        }

        public Task<bool> AnyUserByEmailAsync(string email)
        {
            return _db.Users.AnyAsync(u => u.Email == email);
        }

        public Task<User?> GetUserByEmailAsync(string email)
        {
            return _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        }

        public Task<User?> GetUserByEmailWithProfileAsync(string email)
        {
            return _db.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        public Task<User?> GetUserByIdAsync(int userId)
        {
            return _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        }

        public Task AddUserAsync(User user)
        {
            _db.Users.Add(user);
            return Task.CompletedTask;
        }

        public Task AddUserProfileAsync(UserProfile profile)
        {
            _db.UserProfiles.Add(profile);
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync()
        {
            return _db.SaveChangesAsync();
        }
    }
}
