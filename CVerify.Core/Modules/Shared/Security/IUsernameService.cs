using System;
using System.Threading;
using System.Threading.Tasks;
using CVerify.API.Modules.Shared.Domain.Entities;

namespace CVerify.API.Modules.Shared.Security;

public interface IUsernameService
{
    void ValidateUsername(string username);
    bool IsReserved(string username);
    string Normalize(string username);
    string GenerateBaseUsername(string email);
    Task<string> GenerateUniqueUsernameAsync(string email, CancellationToken cancellationToken = default);
    Task<string> RunWithUsernameRetryAsync(User user, string email, Func<Task> saveAction, int maxRetries = 5, CancellationToken cancellationToken = default);
    Task CheckChangeCooldownAsync(Guid userId, CancellationToken cancellationToken = default);
}
