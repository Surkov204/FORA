namespace FORA.Models;

public sealed class PostPoll
{
    public int PostId { get; set; }
    public DateTimeOffset ClosesAt { get; set; }
    public List<PostPollOption> Options { get; set; } = [];
}

public sealed class PostPollOption
{
    public int PostId { get; set; }
    public int Number { get; set; }
    public required string Text { get; set; }
    public List<PostPollVote> Votes { get; set; } = [];
}

public sealed class PostPollVote
{
    public int PostId { get; set; }
    public int UserId { get; set; }
    public int OptionNumber { get; set; }
}
