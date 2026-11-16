namespace FORA.DTOs;

public sealed class SocialPostDto : ProfileUserPostDto
{
    public bool IsSaved { get; init; }
}
