using System.Security.Claims;
using FORA.Data;
using FORA.Models;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FORA.Controllers;

[ApiController, Authorize, Route("api/questions")]
public sealed class QuestionsController(AppDbContext db, NotificationPublisher publisher) : ControllerBase
{
    [HttpPut("{postId:int}/accepted-answer")]
    public async Task<IActionResult> AcceptAnswer(int postId, SetAnswerRequest request)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await using var transaction = await db.Database.BeginTransactionAsync();
        var post = await db.LockPostAsync(postId);
        if (post?.QuestionTopic is null) return NotFound();
        if (post.UserId != userId) return Forbid();

        int? answerAuthor = null;
        if (request.CommentId is int commentId)
        {
            answerAuthor = await db.Comments.Where(comment => comment.Id == commentId
                    && comment.PostId == postId && comment.ParentCommentId == null && comment.DeletedAt == null)
                .Select(comment => (int?)comment.UserId).SingleOrDefaultAsync();
            if (!answerAuthor.HasValue) return BadRequest(new { message = "Select an active top-level answer on this question." });
        }

        if (post.AcceptedAnswerId == request.CommentId) return Ok(new { post.AcceptedAnswerId });
        post.AcceptedAnswerId = request.CommentId;
        var recipient = answerAuthor != userId ? answerAuthor : null;
        if (recipient is int recipientId)
        {
            db.Notifications.Add(new Notification
            {
                ActorId = userId, RecipientId = recipientId, Kind = Notification.AnswerAccepted,
                PostId = postId, CommentId = request.CommentId
            });
        }

        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        if (recipient is int notifiedUser) await publisher.PublishAsync([notifiedUser]);
        return Ok(new { post.AcceptedAnswerId });
    }
}

public sealed record SetAnswerRequest(int? CommentId);
