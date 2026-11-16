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

            PostPoll? poll = null;
            if (dto.Poll is { } request)
            {
                var options = request.Options?.Select(text => text?.Trim() ?? "").ToList();
                if (string.IsNullOrWhiteSpace(dto.Content) || dto.Content.Length > 5000
                    || options is not { Count: >= 2 and <= 4 }
                    || options.Any(text => text.Length is 0 or > 80)
                    || options.Distinct(StringComparer.OrdinalIgnoreCase).Count() != options.Count
                    || request.DurationHours is not (1 or 24 or 72 or 168))
                {
                    return ServiceResult.From(StatusCodes.Status400BadRequest, new
                    {
                        message = "Enter a question, 2–4 distinct options up to 80 characters, and a valid duration."
                    });
                }

                poll = new PostPoll
                {
                    ClosesAt = DateTimeOffset.UtcNow.AddHours(request.DurationHours),
                    Options = options.Select((text, index) => new PostPollOption { Number = index + 1, Text = text }).ToList()
                };
            }

            var cleanedMediaUrls = new List<string>();
            if (dto.MediaUrls != null && dto.MediaUrls.Count > 0)
            {
                cleanedMediaUrls = dto.MediaUrls
                    .Where(url => !string.IsNullOrWhiteSpace(url))
                    .Select(url => url.Trim())
                    .ToList();
            }

            var post = new Post
            {
                UserId = userId.Value,
                Content = dto.Content,
                CreatedAt = DateTime.UtcNow,
                Poll = poll,
                Media = cleanedMediaUrls.Select(url => new PostMedia
                {
                    Url = url,
                    Type = "image",
                    CreatedAt = DateTime.UtcNow
                }).ToList()
            };
            await _postRepository.AddPostAsync(post);
            await _postRepository.SaveChangesAsync();

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
