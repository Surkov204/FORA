using FORA.DTOs;

namespace FORA.Services
{
    public interface ICommentService
    {
        Task<ServiceResult> AddCommentAsync(int? userId, CreateCommentDto request);
        Task<ServiceResult> GetCommentsByPostIdAsync(int postId);
    }
}
