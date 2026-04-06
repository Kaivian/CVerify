using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System;
using System.Threading.Tasks;

namespace CVerify.API.API.Hubs;

[Authorize]
public class AdminHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var isSystemAdmin = Context.User?.IsInRole("SUPER_ADMIN") == true || Context.User?.IsInRole("ADMIN") == true;
        if (isSystemAdmin)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "admins");
        }
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "admins");
        await base.OnDisconnectedAsync(exception);
    }
}
