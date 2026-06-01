
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Admin.Hubs;

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
