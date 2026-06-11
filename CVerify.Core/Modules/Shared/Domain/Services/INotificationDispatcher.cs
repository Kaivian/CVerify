using System;
using System.Threading.Tasks;

namespace CVerify.API.Modules.Shared.Domain.Services;

public interface INotificationDispatcher
{
    Task PublishNotificationAsync(Guid userId, object notificationDto);
}
