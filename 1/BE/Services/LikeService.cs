using FORA.DTOs;
using FORA.Models;
using FORA.Repositories;

namespace FORA.Services;

public sealed class LikeService(ILikeRepository repository) : ILikeService
{
    public Task<ServiceResult> ToggleLikeAsync(int? userId, int postId) =>
        ChangeAsync(userId, postId, kind: null, toggleLike: true);

    public Task<ServiceResult> SetReactionAsync(int? userId, int postId, string? kind) =>
        ChangeAsync(userId, postId, kind, toggleLike: false);

    private async Task<ServiceResult> ChangeAsync(int? userId, int postId, string? kind, bool toggleLike)
    {
        if (userId is null)
            return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
        if (kind is not (null or PostLike.Like or PostLike.Helpful or PostLike.Funny or PostLike.Celebrate))
            return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Select a supported reaction." });

        var summary = await repository.ChangeReactionAsync(postId, userId.Value, kind, toggleLike);
        return summary is null
            ? ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Post not found" })
            : ServiceResult.From(StatusCodes.Status200OK, new ReactionResultDto(summary));
    }
}
