using System;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Domain.Services;

public interface INotificationChannel
{
    string Name { get; }
    Task DeliverAsync(ActivityEvent activityEvent, Guid recipientUserId);
}
