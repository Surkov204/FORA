namespace FORA.Models
{
    public class PostLike
    {
        public int UserId { get; set; }
        public int PostId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
