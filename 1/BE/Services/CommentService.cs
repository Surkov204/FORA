using FORA.DTOs;
using FORA.Repositories;
using Microsoft.AspNetCore.Http;

namespace FORA.Services
{
    public class CommentService : ICommentService
    {
        private readonly ICommentRepository _commentRepository;

        public CommentService(ICommentRepository commentRepository)
        {
            _commentRepository = commentRepository;
        }

        public async Task<ServiceResult> AddCommentAsync(int? userId, CreateCommentDto request)
        {
            if (userId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            var post = await _commentRepository.GetPostByIdAsync(request.PostId);
            if (post == null)
            {
                return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Bai viet khong ton tai." });
            }

            var comment = await _commentRepository.AddCommentWithPostCountAsync(post, userId.Value, request.Content);
            var userProfile = await _commentRepository.GetUserProfileByUserIdAsync(userId.Value);

            var response = new CommentDto
            {
                Id = comment.Id,
                Content = comment.Content,
                CreatedAt = comment.CreatedAt,
                UserId = userId.Value,
                UserDisplayName = userProfile?.DisplayName ?? "Unknown User",
                UserAvatarUrl = userProfile?.AvatarUrl
            };

            return ServiceResult.From(StatusCodes.Status200OK, response);
        }

        public async Task<ServiceResult> GetCommentsByPostIdAsync(int postId)
        {
            var comments = await _commentRepository.GetCommentsByPostIdAsync(postId);
            return ServiceResult.From(StatusCodes.Status200OK, comments);
        }
    }
}
