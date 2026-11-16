using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using FORA.Data;
using FORA.DTOs;
using FORA.Models;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FORA.Controllers;

[ApiController, Authorize, Route("api/social")]
public class SocialController(AppDbContext db, NotificationPublisher publisher) : ControllerBase
{
    private int CurrentId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("feed")]
    public async Task<IActionResult> Feed(string? q, string tab = "latest", int page = 1, int pageSize = 10,
        string? topic = null, string? status = null)
    {
        if (page < 1 || page > 100000 || pageSize < 1 || pageSize > 50) return BadRequest(new { message = "Invalid pagination." });
        if (tab is not ("latest" or "following" or "saved" or "questions")) return BadRequest();
        if ((topic != null && !Post.IsQuestionTopic(topic)) || (status != null && status is not ("open" or "solved")))
            return BadRequest(new { message = "Invalid question filters." });
        var id = CurrentId;
        var query = db.Posts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(p => p.Content.Contains(q.Trim()) || p.User.Profile!.DisplayName.Contains(q.Trim()));
        if (tab == "following") query = query.Where(p => db.UserFollows.Any(f => f.FollowerId == id && f.FollowingId == p.UserId));
        if (tab == "saved") query = query.Where(p => db.PostBookmarks.Any(b => b.UserId == id && b.PostId == p.Id));
        if (tab == "questions")
        {
            query = query.Where(p => p.QuestionTopic != null);
            if (topic != null) query = query.Where(p => p.QuestionTopic == topic);
            if (status == "open") query = query.Where(p => p.AcceptedAnswerId == null);
            if (status == "solved") query = query.Where(p => p.AcceptedAnswerId != null);
        }
        var total = await query.CountAsync();
        var pageQuery = query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
            .Skip((page - 1) * pageSize).Take(pageSize);
        var items = await ProjectPosts(pageQuery, id).ToListAsync();
        return Ok(new { items, total, hasMore = (long)page * pageSize < total });
    }

    [HttpGet("posts/{postId:int}")]
    public async Task<IActionResult> PostDetails(int postId)
    {
        var post = await ProjectPosts(db.Posts.AsNoTracking().Where(p => p.Id == postId), CurrentId).SingleOrDefaultAsync();
        return post is null ? NotFound(new { message = "This post is no longer available." }) : Ok(post);
    }

    [HttpGet("members/{userId:int}/posts")]
    public async Task<IActionResult> MemberPosts(int userId, int? beforeId)
    {
        if (userId <= 0 || beforeId is <= 0) return BadRequest();
        if (!await db.UserProfiles.AnyAsync(profile => profile.UserId == userId)) return NotFound();
        const int pageSize = 10;
        var posts = db.Posts.AsNoTracking()
            .Where(post => post.UserId == userId && (!beforeId.HasValue || post.Id < beforeId))
            .OrderByDescending(post => post.Id).Take(pageSize + 1);
        var items = await ProjectPosts(posts, CurrentId).ToListAsync();
        int? nextBeforeId = null;
        if (items.Count > pageSize)
        {
            items.RemoveAt(pageSize);
            nextBeforeId = items[^1].Id;
        }
        var isFollowing = await db.UserFollows.AnyAsync(row => row.FollowerId == CurrentId && row.FollowingId == userId);
        return Ok(new { items, nextBeforeId, isFollowing });
    }

    private IQueryable<SocialPostDto> ProjectPosts(IQueryable<Post> posts, int id)
    {
        var polls = PostPollQueries.ForViewer(db, id);
        var reactions = PostReactionQueries.ForViewer(db, id);
        return posts.Select(p => new SocialPostDto
        {
            Id = p.Id,
            QuestionTopic = p.QuestionTopic,
            AcceptedAnswerId = p.AcceptedAnswerId,
            UserId = p.UserId,
            Content = p.Content,
            CreatedAt = p.CreatedAt,
            Reactions = reactions.Where(row => row.PostId == p.Id).Select(row => row.Summary).First(),
            CommentCount = db.Comments.Count(c => c.PostId == p.Id && c.DeletedAt == null),
            UserDisplayName = p.User.Profile != null ? p.User.Profile.DisplayName : "User",
            UserAvatar = p.User.Profile != null ? p.User.Profile.AvatarUrl : null,
            IsSaved = db.PostBookmarks.Any(b => b.PostId == p.Id && b.UserId == id),
            Media = p.Media.OrderBy(m => m.Id).Select(m => new ProfileUserPostMediaDto { Url = m.Url, Type = m.Type }).ToList(),
            Poll = polls.FirstOrDefault(poll => poll.PostId == p.Id)
        });
    }

    [HttpGet("people")]
    public async Task<IActionResult> People(string? q, int page = 1)
    {
        if (page < 1 || page > 100000) return BadRequest();
        var id = CurrentId;
        var query = db.UserProfiles.AsNoTracking().Where(p => p.UserId != id);
        if (!string.IsNullOrWhiteSpace(q)) query = query.Where(p => p.DisplayName.Contains(q.Trim()));
        return Ok(await query.OrderBy(p => p.DisplayName).ThenBy(p => p.UserId).Skip((page - 1) * 10).Take(10).Select(p => new {
            p.UserId, p.DisplayName, p.AvatarUrl, p.Bio,
            IsFollowing = db.UserFollows.Any(f => f.FollowerId == id && f.FollowingId == p.UserId),
            FollowerCount = db.UserFollows.Count(f => f.FollowingId == p.UserId)
        }).ToListAsync());
    }

    [HttpGet("stats")]
    public async Task<IActionResult> Stats() => Ok(new {
        followerCount = await db.UserFollows.CountAsync(f => f.FollowingId == CurrentId),
        followingCount = await db.UserFollows.CountAsync(f => f.FollowerId == CurrentId)
    });

    [HttpPut("follow/{userId:int}")]
    public async Task<IActionResult> Follow(int userId, ToggleRequest request)
    {
        var id = CurrentId;
        if (id == userId) return BadRequest(new { message = "You cannot follow yourself." });
        await using var transaction = await db.Database.BeginTransactionAsync();
        // Serialize follow transitions targeting the same member to keep the notification in sync.
        var target = await db.Users.FromSqlInterpolated($"SELECT * FROM [Users] WITH (UPDLOCK, HOLDLOCK) WHERE [Id] = {userId}")
            .AsNoTracking().SingleOrDefaultAsync();
        if (target is null) return NotFound();
        var follow = await db.UserFollows.FindAsync(id, userId);
        var newFollow = request.Active && follow == null;
        if (newFollow)
        {
            db.UserFollows.Add(new() { FollowerId = id, FollowingId = userId });
            db.Notifications.Add(new Notification { RecipientId = userId, ActorId = id, Kind = Notification.Follow });
        }
        if (!request.Active && follow != null) db.UserFollows.Remove(follow);
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        if (newFollow) await publisher.PublishAsync([userId]);
        var followerCount = await db.UserFollows.CountAsync(row => row.FollowingId == userId);
        return Ok(new { isFollowing = request.Active, followerCount });
    }

    [HttpPut("bookmarks/{postId:int}")]
    public async Task<IActionResult> Bookmark(int postId, ToggleRequest request)
    {
        if (!await db.Posts.AnyAsync(p => p.Id == postId)) return NotFound();
        var bookmark = await db.PostBookmarks.FindAsync(CurrentId, postId);
        if (request.Active && bookmark == null) db.PostBookmarks.Add(new() { UserId = CurrentId, PostId = postId });
        if (!request.Active && bookmark != null) db.PostBookmarks.Remove(bookmark);
        await db.SaveChangesAsync();
        return Ok(new { isSaved = request.Active });
    }

    [HttpPut("posts/{postId:int}")]
    public async Task<IActionResult> Edit(int postId, EditPostRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest(new { message = "Post content is required." });
        var post = await db.Posts.Include(p => p.Poll).FirstOrDefaultAsync(p => p.Id == postId);
        if (post == null) return NotFound();
        if (post.UserId != CurrentId) return Forbid();
        if (post.Poll != null) return Conflict(new { message = "Published poll questions cannot be edited." });
        post.Content = request.Content.Trim();
        await db.SaveChangesAsync();
        return Ok(new { post.Id, post.Content });
    }
}

public record ToggleRequest(bool Active);
public record EditPostRequest([Required, MaxLength(5000)] string Content);
