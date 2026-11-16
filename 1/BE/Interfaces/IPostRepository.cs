using FORA.Models;

namespace FORA.Repositories
{
    public interface IPostRepository
    {
        Task AddPostAsync(Post post);
        Task<Post?> GetPostByIdAsync(int postId);
        Task DeletePostWithRelationsAsync(Post post);
        Task SaveChangesAsync();
    }
}
