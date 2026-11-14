namespace FORA.DTOs
{
    public class ProfileDto
    {
        public int UserId { get; set; }
        public string DisplayName { get; set; } = null!;
        public string? Bio { get; set; }
        public string? AvatarUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public int PostCount { get; set; }
    }
}
