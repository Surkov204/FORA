using FORA.Models;
using FORA.DTOs;
using Microsoft.EntityFrameworkCore;
using FORA.Data;

public interface ICommentService
{
    Task<CommentDto> AddCommentAsync(int userId, CreateCommentDto request);
    Task<List<CommentDto>> GetCommentsByPostIdAsync(int postId);
}

public class CommentService : ICommentService
{
    private readonly AppDbContext _context;

    public CommentService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CommentDto> AddCommentAsync(int userId, CreateCommentDto request)
    {
        // 1. Kiểm tra bài viết có tồn tại không
        var post = await _context.Posts.FindAsync(request.PostId);
        if (post == null)
        {
            throw new Exception("Bài viết không tồn tại."); // Nên dùng Custom Exception
        }

        // 2. Tạo Entity Comment
        var comment = new Comment
        {
            PostId = request.PostId,
            UserId = userId,
            Content = request.Content,
            CreatedAt = DateTime.UtcNow
        };

        // 3. Logic Transaction: Thêm Comment VÀ Tăng CommentCount
        using var transaction = _context.Database.BeginTransaction();
        try
        {
            _context.Comments.Add(comment);
            
            // Cập nhật số lượng comment (Denormalization)
            post.CommentCount += 1; 
            
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        // 4. Lấy thông tin UserProfile để trả về (để hiển thị Avatar/Tên ngay lập tức)
        var userProfile = await _context.UserProfiles
            .FirstOrDefaultAsync(u => u.UserId == userId);

        return new CommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            CreatedAt = comment.CreatedAt,
            UserId = userId,
            UserDisplayName = userProfile?.DisplayName ?? "Unknown User",
            UserAvatarUrl = userProfile?.AvatarUrl
        };
    }

   public async Task<List<CommentDto>> GetCommentsByPostIdAsync(int postId)
{
    return await _context.Comments
        .Where(c => c.PostId == postId)
        .Include(c => c.User)
            .ThenInclude(u => u.Profile)
        .OrderByDescending(c => c.CreatedAt)
        .Select(c => new CommentDto
        {
            Id = c.Id,
            Content = c.Content,
            CreatedAt = c.CreatedAt,
            UserId = c.UserId,

            UserDisplayName = c.User.Profile.DisplayName,
            UserAvatarUrl   = c.User.Profile.AvatarUrl
        })
        .AsNoTracking()
        .ToListAsync();
}


}