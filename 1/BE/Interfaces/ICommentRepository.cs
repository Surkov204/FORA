using FORA.DTOs;
using FORA.Models;

namespace FORA.Repositories
{
    public interface ICommentRepository
    {
        Task<Post?> GetPostByIdAsync(int postId);
        Task<Comment> AddCommentWithPostCountAsync(Post post, int userId, string content);
        Task<UserProfile?> GetUserProfileByUserIdAsync(int userId);
        Task<List<CommentDto>> GetCommentsByPostIdAsync(int postId);
    }
}
