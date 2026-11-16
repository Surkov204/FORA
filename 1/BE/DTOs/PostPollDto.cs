namespace FORA.DTOs;

public sealed record CreatePostPollDto(List<string?>? Options, int DurationHours);

public sealed class PostPollDto
{
    public int PostId { get; init; }
    public DateTimeOffset ClosesAt { get; init; }
    public int? MyOption { get; init; }
    public required List<PostPollOptionDto> Options { get; init; }
}

public sealed record PostPollOptionDto(int Number, string Text, int VoteCount);

public sealed record PostPollResultsDto(int PostId, List<PostPollOptionDto> Options);
