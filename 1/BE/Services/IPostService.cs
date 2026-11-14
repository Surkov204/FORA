using FORA.DTOs;

namespace FORA.Services
{
    public interface IPostService
    {
        Task<ServiceResult> CreatePostAsync(int? userId, CreatePostDto dto);
        Task<ServiceResult> DeletePostAsync(int? userId, int postId);
    }
}
