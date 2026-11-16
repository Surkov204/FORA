using FORA.DTOs;
using FORA.Models;

namespace FORA.Repositories;

public interface ICommentRepository
{
    Task<Comment?> AddAsync(int postId, int userId, int? parentCommentId, int? replyToCommentId, string content);
    Task<Comment?> FindAsync(int id);
    Task<bool> UpdateAsync(int id, int userId, string content);
    Task<bool> DeleteAsync(Comment comment);
    Task<CommentDto?> GetVisibleAsync(int postId, int id);
    Task<List<CommentDto>> GetPageAsync(int postId, int? parentCommentId, int? beforeId, int limit);
    Task<int> CountAsync(int postId);
}
