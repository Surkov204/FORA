using FORA.DTOs;

namespace FORA.Repositories;

public interface ILikeRepository
{
    Task<PostReactionsDto?> ChangeReactionAsync(int postId, int userId, string? kind, bool toggleLike);
}
