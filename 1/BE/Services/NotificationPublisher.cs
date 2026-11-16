using System.Globalization;
using FORA.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace FORA.Services;

public sealed class NotificationPublisher(IHubContext<CommunityHub> hub, ILogger<NotificationPublisher> logger)
{
    public async Task PublishAsync(IEnumerable<int> recipients)
    {
        var users = recipients.Distinct().Select(id => id.ToString(CultureInfo.InvariantCulture)).ToArray();
        if (users.Length == 0) return;
        try
        {
            await hub.Clients.Users(users).SendAsync("NotificationsChanged");
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Could not signal notification changes");
        }
    }
}
