namespace FORA.Models
{
    public class User
    {
        public int Id { get; set; }

        public string Email { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;

        // Email verification
        public bool IsEmailVerified { get; set; } = false;
        public string? EmailVerificationTokenHash { get; set; }
        public DateTime? EmailVerificationExpiresAt { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastLoginAt { get; set; }
        public string? PasswordResetTokenHash { get; set; }
        public DateTime? PasswordResetExpiresAt { get; set; }


        public UserProfile? Profile { get; set; }
    }
}
