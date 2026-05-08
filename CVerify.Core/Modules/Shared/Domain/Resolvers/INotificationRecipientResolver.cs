using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Domain.Resolvers;

public interface INotificationRecipientResolver
{
    Task<IEnumerable<Guid>> ResolveRecipientsAsync(ActivityEvent activityEvent);
}
