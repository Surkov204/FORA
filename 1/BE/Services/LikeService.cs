using FORA.Models;
using FORA.Repositories;
using Microsoft.AspNetCore.Http;

namespace FORA.Services
{
    public class LikeService : ILikeService
    {
        private readonly ILikeRepository _likeRepository;

        public LikeService(ILikeRepository likeRepository)
        {
            _likeRepository = likeRepository;
        }

        public async Task<ServiceResult> ToggleLikeAsync(int? userId, int postId)
        {
            if (userId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            var post = await _likeRepository.GetPostByIdAsync(postId);
            if (post == null)
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Post not found" });
            }

            var like = await _likeRepository.GetLikeAsync(postId, userId.Value);
            bool isLiked;

            if (like == null)
            {
                await _likeRepository.AddLikeAsync(new PostLike
                {
                    PostId = postId,
                    UserId = userId.Value,
                    CreatedAt = DateTime.UtcNow
                });

                post.LikeCount += 1;
                isLiked = true;
            }
            else
            {
                _likeRepository.RemoveLike(like);
                post.LikeCount = Math.Max(0, post.LikeCount - 1);
                isLiked = false;
            }

            await _likeRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                isLiked,
                likeCount = post.LikeCount
            });
        }
    }
}
