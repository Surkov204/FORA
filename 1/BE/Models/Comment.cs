using System.ComponentModel.DataAnnotations;

namespace FORA.Models
{
    public class Comment
    {
        public int Id { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int UserId { get; set; }
        public User? User { get; set; }

        public int PostId { get; set; }
        public Post? Post { get; set; }
        public int? ParentCommentId { get; set; }
        public DateTimeOffset? EditedAt { get; set; }
        public DateTimeOffset? DeletedAt { get; set; }
        public ICollection<Comment> Replies { get; set; } = [];
    }
}
