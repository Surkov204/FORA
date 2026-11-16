using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace FORA.Hubs;

[Authorize]
public sealed class CommunityHub : Hub
{
}
