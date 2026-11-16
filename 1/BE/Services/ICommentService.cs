using FORA.DTOs;

namespace FORA.Services;

public interface ICommentService
{
    Task<ServiceResult> AddAsync(int userId, CreateCommentDto request);
    Task<ServiceResult> UpdateAsync(int userId, int commentId, UpdateCommentDto request);
    Task<ServiceResult> DeleteAsync(int userId, int commentId);
    Task<ServiceResult> GetPageAsync(int postId, int? parentCommentId, int? beforeId);
    Task<ServiceResult> GetTargetAsync(int postId, int commentId);
}
