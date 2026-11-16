namespace FORA.Services
{
    public interface ILikeService
    {
        Task<ServiceResult> ToggleLikeAsync(int? userId, int postId);
        Task<ServiceResult> SetReactionAsync(int? userId, int postId, string? kind);
    }
}
