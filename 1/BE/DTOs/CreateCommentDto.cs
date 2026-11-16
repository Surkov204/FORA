using System.ComponentModel.DataAnnotations;

namespace FORA.DTOs
{
    // Dữ liệu client gửi lên để tạo comment
    public class CreateCommentDto
    {
        public int PostId { get; set; }
        public int? ParentCommentId { get; set; }
        public int? ReplyToCommentId { get; set; }
        
        [Required(ErrorMessage = "Nội dung không được để trống")]
        [MaxLength(1000, ErrorMessage = "Nội dung không quá 1000 ký tự")]
        public string Content { get; set; } = string.Empty;
    }

    // Dữ liệu trả về cho client
    public class CommentDto
    {
        public int? ParentCommentId { get; init; }
        public DateTimeOffset? EditedAt { get; init; }
        public bool IsDeleted { get; init; }
        public int ReplyCount { get; init; }
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int UserId { get; set; }
        public string UserDisplayName { get; set; } = string.Empty; // Để hiển thị tên người comment
        public string? UserAvatarUrl { get; set; } // Để hiển thị avatar
    }
    public sealed record UpdateCommentDto([Required, MaxLength(1000)] string Content);
    public sealed record CommentPageDto(List<CommentDto> Items, int? NextBeforeId, int Total, CommentDto? AcceptedAnswer);
    public sealed record CommentMutationDto(CommentDto? Comment, CommentDto? Root, int Total, int? AcceptedAnswerId);
    public sealed record CommentTargetDto(CommentDto Root, CommentDto Target);
}
