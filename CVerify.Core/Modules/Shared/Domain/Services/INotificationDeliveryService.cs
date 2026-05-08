using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Domain.Services;

public interface INotificationDeliveryService
{
    Task RouteAndDeliverAsync(ActivityEvent activityEvent);
}
