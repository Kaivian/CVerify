using System;

namespace CVerify.API.Modules.Shared.System.Services;

public interface IRateLimitPolicyService
{
    bool DisableRateLimits { get; }
    void LogBypass(string actionName, string? endpoint = null, string? identifier = null);
}
