using FORA.DTOs;
using FORA.Models;
using FORA.Repositories;
using Microsoft.AspNetCore.Http;

namespace FORA.Services
{
    public class PostService : IPostService
    {
        private readonly IPostRepository _postRepository;

        public PostService(IPostRepository postRepository)
        {
            _postRepository = postRepository;
        }

        public async Task<ServiceResult> CreatePostAsync(int? userId, CreatePostDto dto)
        {
            if (userId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            var post = new Post
            {
                UserId = userId.Value,
                Content = dto.Content,
                CreatedAt = DateTime.UtcNow
            };

            await _postRepository.AddPostAsync(post);
            await _postRepository.SaveChangesAsync();

            var cleanedMediaUrls = new List<string>();
            if (dto.MediaUrls != null && dto.MediaUrls.Count > 0)
            {
                cleanedMediaUrls = dto.MediaUrls
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select(url => url.Trim())
                    .ToList();

                if (cleanedMediaUrls.Count > 0)
                {
                    var mediaEntities = cleanedMediaUrls.Select(url => new PostMedia
                    {
                        PostId = post.Id,
                        Url = url,
                        Type = "image",
                        CreatedAt = DateTime.UtcNow
                    });

                    await _postRepository.AddPostMediaRangeAsync(mediaEntities);
                    await _postRepository.SaveChangesAsync();
                }
            }

            return ServiceResult.From(StatusCodes.Status200OK, new
            {
                post.Id,
                post.Content,
                post.CreatedAt,
                media = cleanedMediaUrls
            });
        }

        public async Task<ServiceResult> DeletePostAsync(int? userId, int postId)
        {
            if (userId == null)
            {
                return ServiceResult.From(StatusCodes.Status401Unauthorized, new { message = "Unauthorized" });
            }

            var post = await _postRepository.GetPostByIdAsync(postId);
            if (post == null)
            {
                return ServiceResult.From(StatusCodes.Status404NotFound, new { message = "Post not found" });
            }

            if (post.UserId != userId.Value)
            {
                return ServiceResult.From(StatusCodes.Status403Forbidden, new { message = "You cannot delete another user's post" });
            }

            await _postRepository.DeletePostWithRelationsAsync(post);
            await _postRepository.SaveChangesAsync();

            return ServiceResult.From(StatusCodes.Status200OK, new { message = "Post deleted", postId });
        }
    }
}
