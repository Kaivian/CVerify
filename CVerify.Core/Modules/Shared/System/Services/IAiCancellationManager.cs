using System;
using System.Threading;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IAiCancellationManager
{
    CancellationToken Register(Guid sessionId, CancellationToken linkToken = default);
    void Cancel(Guid sessionId);
    void Unregister(Guid sessionId);
}
