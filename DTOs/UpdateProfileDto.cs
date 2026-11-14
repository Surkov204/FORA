namespace FORA.DTOs
{
    public class UpdateProfileDto
    {
        public string DisplayName { get; set; } = null!;
        public string? Bio { get; set; }
        public string? AvatarUrl { get; set; }
    }
}
