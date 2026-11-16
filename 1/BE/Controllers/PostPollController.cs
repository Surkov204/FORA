using System.Security.Claims;
using FORA.Data;
using FORA.DTOs;
using FORA.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace FORA.Controllers;

[ApiController, Authorize, Route("api/posts/{postId:int}/poll")]
public sealed class PostPollController(
    AppDbContext db, IHubContext<CommunityHub> hub, ILogger<PostPollController> logger) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<PostPollDto>> Get(int postId, CancellationToken cancellationToken)
    {
        var poll = await PostPollQueries.ForViewer(db, UserId)
            .SingleOrDefaultAsync(p => p.PostId == postId, cancellationToken);
        return poll is null ? NotFound() : Ok(poll);
    }

    [HttpPut("vote")]
    public async Task<ActionResult<PostPollDto>> Vote(
        int postId, VoteRequest request, CancellationToken cancellationToken)
    {
        if (request.OptionNumber is < 1 or > 4)
        {
            return BadRequest(new { message = "Choose an option in this poll." });
        }

        var userId = UserId;
        // Lock the unique (PostId, UserId) key range while checking and inserting.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO [PostPollVotes] ([PostId], [UserId], [OptionNumber])
            SELECT {postId}, {userId}, {request.OptionNumber}
            WHERE EXISTS (
                SELECT 1 FROM [PostPolls] WITH (HOLDLOCK)
                WHERE [PostId] = {postId} AND [ClosesAt] > SYSDATETIMEOFFSET()
            ) AND EXISTS (
                SELECT 1 FROM [PostPollOptions] WITH (HOLDLOCK)
                WHERE [PostId] = {postId} AND [Number] = {request.OptionNumber}
            ) AND EXISTS (
                SELECT 1 FROM [Users] WITH (HOLDLOCK) WHERE [Id] = {userId}
            ) AND NOT EXISTS (
                SELECT 1 FROM [PostPollVotes] WITH (UPDLOCK, HOLDLOCK)
                WHERE [PostId] = {postId} AND [UserId] = {userId}
            )
            """, cancellationToken);

        var poll = await PostPollQueries.ForViewer(db, userId)
            .SingleOrDefaultAsync(p => p.PostId == postId, inserted > 0 ? CancellationToken.None : cancellationToken);
        if (poll is null) return NotFound();

        if (inserted > 0)
        {
            try
            {
                await hub.Clients.All.SendAsync("PollUpdated", new PostPollResultsDto(poll.PostId, poll.Options));
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Could not broadcast the vote for post {PostId}", postId);
            }
        }
        else if (poll.MyOption != request.OptionNumber)
        {
            if (poll.MyOption.HasValue) return Conflict(new { message = "You already voted in this poll.", poll });
            if (poll.ClosesAt <= DateTimeOffset.UtcNow) return Conflict(new { message = "Voting has closed." });
            if (!poll.Options.Any(option => option.Number == request.OptionNumber))
            {
                return BadRequest(new { message = "Choose an option in this poll." });
            }

            return Unauthorized();
        }

        return Ok(poll);
    }
}

public sealed record VoteRequest(int OptionNumber);
