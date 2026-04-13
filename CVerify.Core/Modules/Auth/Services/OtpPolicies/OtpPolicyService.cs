using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using CVerify.API.Modules.Shared.Configuration;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Auth.Services.OtpPolicies;

public class OtpPolicyService : IOtpPolicyService
{
    private readonly Dictionary<string, OtpPolicyDefinition> _policies = new(StringComparer.OrdinalIgnoreCase);

    public OtpPolicyService(IConfiguration configuration, EnvConfiguration envConfig)
    {
        // Bind policies from configuration
        var section = configuration.GetSection("OtpPolicies");
        if (section.Exists())
        {
            foreach (var child in section.GetChildren())
            {
                var policy = new OtpPolicyDefinition();
                child.Bind(policy);
                _policies[child.Key] = policy;
            }
        }

        // Enforce fallback default policy if not provided in config
        if (!_policies.ContainsKey("Default"))
        {
            _policies["Default"] = new OtpPolicyDefinition
            {
                Length = 6,
                AllowedCharacters = "Numeric",
                CooldownSeconds = 60,
                ExpirationSeconds = 300,
                MaxRetries = 3
            };
        }

        // Configuration-driven rate limiting policy overrides for local development and testing
        if (envConfig.Security.DisableRateLimits)
        {
            foreach (var policy in _policies.Values)
            {
                policy.CooldownSeconds = 0;
                policy.MaxRetries = 9999;
                policy.MaxResends = 9999;
            }
        }
    }


    public bool Validate(string code, string policyId = "Default")
    {
        if (!_policies.TryGetValue(policyId, out var policy))
        {
            policy = _policies["Default"];
        }

        if (string.IsNullOrEmpty(code))
        {
            return false;
        }

        if (code.Length != policy.Length)
        {
            return false;
        }

        if (policy.AllowedCharacters.Equals("Numeric", StringComparison.OrdinalIgnoreCase))
        {
            return Regex.IsMatch(code, "^[0-9]+$");
        }
        else
        {
            return Regex.IsMatch(code, "^[a-zA-Z0-9]+$");
        }
    }

    public void ValidateAndThrow(string code, string policyId = "Default")
    {
        if (!_policies.TryGetValue(policyId, out var policy))
        {
            policy = _policies["Default"];
        }

        var errors = new List<string>();

        if (string.IsNullOrEmpty(code))
        {
            errors.Add("Verification code is required.");
        }
        else
        {
            if (code.Length != policy.Length)
            {
                errors.Add($"Verification code must be exactly {policy.Length} characters long.");
            }

            if (policy.AllowedCharacters.Equals("Numeric", StringComparison.OrdinalIgnoreCase) && !Regex.IsMatch(code, "^[0-9]+$"))
            {
                errors.Add("Verification code must contain digits only.");
            }
            else if (policy.AllowedCharacters.Equals("Alphanumeric", StringComparison.OrdinalIgnoreCase) && !Regex.IsMatch(code, "^[a-zA-Z0-9]+$"))
            {
                errors.Add("Verification code must contain alphanumeric characters only.");
            }
        }

        if (errors.Count > 0)
        {
            var validationErrors = new Dictionary<string, string[]>
            {
                { "code", errors.ToArray() }
            };
            throw new OtpPolicyViolationException(validationErrors, string.Join(" ", errors));
        }
    }

    public OtpPolicyDefinition GetPolicy(string policyId = "Default")
    {
        if (!_policies.TryGetValue(policyId, out var policy))
        {
            policy = _policies["Default"];
        }
        return policy;
    }
}
