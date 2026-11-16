using FORA.DTOs;
using FORA.Models;
using FORA.Repositories;

namespace FORA.Services;

public sealed class CommentService(ICommentRepository repository) : ICommentService
{
    private const int PageSize = 10;

    public async Task<ServiceResult> AddAsync(int userId, CreateCommentDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Content)) return InvalidContent();
        var comment = await repository.AddAsync(request.PostId, userId, request.ParentCommentId, request.Content.Trim());
        if (comment is null)
        {
            return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "The post or parent comment is unavailable." });
        }

        return await MutationResultAsync(comment);
    }

    public async Task<ServiceResult> UpdateAsync(int userId, int commentId, UpdateCommentDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Content)) return InvalidContent();
        var comment = await repository.FindAsync(commentId);
        if (comment is null) return MissingComment();
        if (comment.UserId != userId) return Forbidden();
        if (!await repository.UpdateAsync(commentId, userId, request.Content.Trim())) return MissingComment();
        return await MutationResultAsync(comment);
    }

    public async Task<ServiceResult> DeleteAsync(int userId, int commentId)
    {
        var comment = await repository.FindAsync(commentId);
        if (comment is null) return MissingComment();
        if (comment.UserId != userId) return Forbidden();
        if (!await repository.DeleteAsync(comment)) return MissingComment();
        return await MutationResultAsync(comment);
    }

    public async Task<ServiceResult> GetPageAsync(int postId, int? parentCommentId, int? beforeId)
    {
        if (postId <= 0 || parentCommentId is <= 0 || beforeId is <= 0)
        {
            return ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Invalid comment page." });
        }

        var comments = await repository.GetPageAsync(postId, parentCommentId, beforeId, PageSize + 1);
        int? nextBeforeId = null;
        if (comments.Count > PageSize)
        {
            comments.RemoveAt(PageSize);
            nextBeforeId = comments[^1].Id;
        }
        return ServiceResult.From(StatusCodes.Status200OK,
            new CommentPageDto(comments, nextBeforeId, await repository.CountAsync(postId)));
    }

    public async Task<ServiceResult> GetTargetAsync(int postId, int commentId)
    {
        var target = await repository.GetVisibleAsync(postId, commentId);
        if (target is null) return MissingComment();
        var root = target.ParentCommentId is int parentId
            ? await repository.GetVisibleAsync(postId, parentId) : target;
        return root is null ? MissingComment() : ServiceResult.From(StatusCodes.Status200OK, new CommentTargetDto(root, target));
    }

    private async Task<ServiceResult> MutationResultAsync(Comment comment)
    {
        var updated = await repository.GetVisibleAsync(comment.PostId, comment.Id);
        var root = comment.ParentCommentId is int parentId
            ? await repository.GetVisibleAsync(comment.PostId, parentId) : null;
        return ServiceResult.From(StatusCodes.Status200OK,
            new CommentMutationDto(updated, root, await repository.CountAsync(comment.PostId)));
    }

    private static ServiceResult InvalidContent() =>
        ServiceResult.From(StatusCodes.Status400BadRequest, new { message = "Enter a comment." });
    private static ServiceResult MissingComment() =>
        ServiceResult.From(StatusCodes.Status404NotFound, new { message = "This comment is no longer available." });
    private static ServiceResult Forbidden() =>
        ServiceResult.From(StatusCodes.Status403Forbidden, new { message = "You can only change your own comments." });
}
