namespace FORA.DTOs;

public sealed class SocialPostDto : ProfileUserPostDto
{
    public int UserId { get; init; }
    public bool IsSaved { get; init; }
}
