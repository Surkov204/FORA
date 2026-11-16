namespace FORA.DTOs;

public sealed class PostQueryDto
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public required string Content { get; init; }
    public DateTime CreatedAt { get; init; }
    public string? UserDisplayName { get; init; }
}
