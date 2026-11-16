using System.Security.Claims;
using FORA.Data;
using FORA.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FORA.Controllers;

[ApiController, Authorize, Route("api/notifications")]
public sealed class NotificationsController(AppDbContext db, NotificationPublisher publisher) : ControllerBase
{
    private const int PageSize = 20;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List(long? beforeId, CancellationToken cancellationToken)
    {
        if (beforeId is <= 0) return BadRequest();
        var owned = db.Notifications.AsNoTracking().Where(row => row.RecipientId == UserId);
        var items = await owned.Where(row => !beforeId.HasValue || row.Id < beforeId)
            .OrderByDescending(row => row.Id).Take(PageSize + 1)
            .Select(row => new
            {
                row.Id, row.ActorId, row.Kind, row.PostId, row.CommentId, row.CreatedAt,
                IsRead = row.ReadAt != null,
                ActorName = row.Actor.Profile == null ? "A member" : row.Actor.Profile.DisplayName
            }).ToListAsync(cancellationToken);
        long? nextBeforeId = null;
        if (items.Count > PageSize)
        {
            items.RemoveAt(PageSize);
            nextBeforeId = items[^1].Id;
        }
        var unread = await owned.CountAsync(row => row.ReadAt == null, cancellationToken);
        return Ok(new { items, unread, nextBeforeId });
    }

    [HttpPut("{notificationId:long}/read")]
    public async Task<IActionResult> Read(long notificationId, CancellationToken cancellationToken)
    {
        var owned = db.Notifications.Where(row => row.RecipientId == UserId && row.Id == notificationId);
        var now = DateTimeOffset.UtcNow;
        var updated = await owned.Where(row => row.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(row => row.ReadAt, now), cancellationToken);
        if (updated > 0) await publisher.PublishAsync([UserId]);
        return updated > 0 || await owned.AnyAsync(cancellationToken) ? NoContent() : NotFound();
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var updated = await db.Notifications.Where(row => row.RecipientId == UserId && row.ReadAt == null)
            .ExecuteUpdateAsync(update => update.SetProperty(row => row.ReadAt, now), cancellationToken);
        if (updated > 0) await publisher.PublishAsync([UserId]);
        return NoContent();
    }
}
