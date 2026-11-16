namespace FORA.DTOs
{
    public class ProfileUserPostDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int LikeCount { get; set; }
        public int CommentCount { get; set; }
        public string UserDisplayName { get; set; } = string.Empty;
        public string? UserAvatar { get; set; }
        public bool IsLiked { get; set; }
        public PostPollDto? Poll { get; set; }
        public List<ProfileUserPostMediaDto> Media { get; set; } = new();
    }

    public class ProfileUserPostMediaDto
    {
        public string Url { get; set; } = string.Empty;
        public string Type { get; set; } = "image";
    }
}
