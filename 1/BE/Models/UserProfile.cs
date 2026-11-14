namespace FORA.Models
{
    public class UserProfile
    {
        public int UserId { get; set; }

        public string DisplayName { get; set; } = null!;

        public string? Bio { get; set; }

        public string? AvatarUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
    }
}
