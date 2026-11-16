using FORA.Models;

namespace FORA.DTOs;

public sealed class PostReactionsDto
{
    public int Like { get; init; }
    public int Helpful { get; init; }
    public int Funny { get; init; }
    public int Celebrate { get; init; }
    public string? MyReaction { get; init; }
}

public sealed record ReactionResultDto(PostReactionsDto Reactions)
{
    public bool IsLiked => Reactions.MyReaction == PostLike.Like;
    public int LikeCount => Reactions.Like;
}
