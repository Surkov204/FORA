namespace FORA.Models
{
    public class PostMedia
    {
        public int Id { get; set; }

        public int PostId { get; set; }
        public Post Post { get; set; } = null!;

        public string Url { get; set; } = null!;
        public string Type { get; set; } = "image";

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
