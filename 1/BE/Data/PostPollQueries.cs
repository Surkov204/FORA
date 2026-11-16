using FORA.DTOs;
using Microsoft.EntityFrameworkCore;

namespace FORA.Data;

internal static class PostPollQueries
{
    public static IQueryable<PostPollDto> ForViewer(AppDbContext db, int userId) =>
        db.PostPolls.AsNoTracking().Select(poll => new PostPollDto
        {
            PostId = poll.PostId,
            ClosesAt = poll.ClosesAt,
            MyOption = db.PostPollVotes.Where(vote => vote.PostId == poll.PostId && vote.UserId == userId)
                .Select(vote => (int?)vote.OptionNumber).FirstOrDefault(),
            Options = poll.Options.OrderBy(option => option.Number)
                .Select(option => new PostPollOptionDto(option.Number, option.Text, option.Votes.Count))
                .ToList()
        });
}
