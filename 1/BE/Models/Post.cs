namespace FORA.Models
{
    public class Post
    {
        public int Id { get; set; }
        public int UserId { get; set; }

        public string Content { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int LikeCount { get; set; } = 0;
        public int CommentCount { get; set; } = 0;

        public User User { get; set; } = null!;
        public ICollection<Comment> Comments { get; set; } = new List<Comment>();
        public ICollection<PostMedia> Media { get; set; } = new List<PostMedia>();
        public PostPoll? Poll { get; set; }
    }
}
