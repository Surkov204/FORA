namespace FORA.Services
{
    public interface ILikeService
    {
        Task<ServiceResult> ToggleLikeAsync(int? userId, int postId);
    }
}
