using System;

namespace CVerify.API.Application.Interfaces;

public interface IRateLimitPolicyService
{
    bool DisableRateLimits { get; }
    void LogBypass(string actionName, string? endpoint = null, string? identifier = null);
}
