namespace FORA.Models;

public sealed class Notification
{
    public long Id { get; set; }
    public int RecipientId { get; set; }
    public int ActorId { get; set; }
    public User Actor { get; set; } = null!;
    public required string Kind { get; set; }
    public int? PostId { get; set; }
    public int? CommentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAt { get; set; }

    public const string Reply = "reply";
    public const string Comment = "comment";
    public const string Follow = "follow";
    public const string AnswerAccepted = "answer-accepted";
}
