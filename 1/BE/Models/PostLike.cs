namespace FORA.Models
{
    public class PostLike
    {
        public const string Like = "like";
        public const string Helpful = "helpful";
        public const string Funny = "funny";
        public const string Celebrate = "celebrate";

        public int UserId { get; set; }
        public int PostId { get; set; }
        public string Kind { get; set; } = Like;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
