using System;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CVerify.API.Modules.Shared.Configuration;

namespace CVerify.API.Modules.Shared.System.Services;

public class RateLimitPolicyService : IRateLimitPolicyService
{
    private readonly EnvConfiguration _envConfig;
    private readonly IHostEnvironment _env;
    private readonly ILogger<RateLimitPolicyService> _logger;
    private readonly TimeProvider _timeProvider;

    public RateLimitPolicyService(
        EnvConfiguration envConfig,
        IHostEnvironment env,
        ILogger<RateLimitPolicyService> logger,
        TimeProvider timeProvider)
    {
        _envConfig = envConfig;
        _env = env;
        _logger = logger;
        _timeProvider = timeProvider;
    }

    public bool DisableRateLimits => _envConfig.Security.DisableRateLimits;

    public bool ShouldEnforceCooldowns() => !DisableRateLimits;

    public void LogBypass(string actionName, string? endpoint = null, string? identifier = null)
    {
        if (!ShouldEnforceCooldowns())
        {
            _logger.LogInformation(
                "[DEV MODE] Rate limit bypass applied for {ActionName}. Environment={Environment}, Endpoint={Endpoint}, Identifier={Identifier}, Timestamp={Timestamp}",
                actionName,
                _env.EnvironmentName,
                endpoint ?? "N/A",
                identifier ?? "N/A",
                _timeProvider.GetUtcNow().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
            );
        }
    }
}
