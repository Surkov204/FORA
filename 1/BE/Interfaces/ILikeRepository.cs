using FORA.Models;

namespace FORA.Repositories
{
    public interface ILikeRepository
    {
        Task<Post?> GetPostByIdAsync(int postId);
        Task<PostLike?> GetLikeAsync(int postId, int userId);
        Task AddLikeAsync(PostLike like);
        void RemoveLike(PostLike like);
        Task SaveChangesAsync();
    }
}
