using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using CVerify.API.Modules.Shared.Exceptions;

namespace CVerify.API.Modules.Auth.Services.PasswordPolicies;

public class PasswordPolicyService : IPasswordPolicyService
{
    private readonly Dictionary<string, PasswordPolicyDefinition> _policies = new(StringComparer.OrdinalIgnoreCase);

    public PasswordPolicyService(IConfiguration configuration)
    {
        // Bind policies from configuration
        var section = configuration.GetSection("PasswordPolicies");
        if (section.Exists())
        {
            foreach (var child in section.GetChildren())
            {
                var policy = new PasswordPolicyDefinition();
                child.Bind(policy);
                _policies[child.Key] = policy;
            }
        }

        // Enforce fallback default policy if not provided in config
        if (!_policies.ContainsKey("Default"))
        {
            _policies["Default"] = new PasswordPolicyDefinition
            {
                MinimumLength = 8,
                RequireUppercase = true,
                RequireLowercase = true,
                RequireDigit = true,
                RequireSpecialCharacter = true
            };
        }

        // Enforce fallback enterprise policy if not provided in config
        if (!_policies.ContainsKey("Enterprise"))
        {
            _policies["Enterprise"] = new PasswordPolicyDefinition
            {
                MinimumLength = 12,
                RequireUppercase = true,
                RequireLowercase = true,
                RequireDigit = true,
                RequireSpecialCharacter = true
            };
        }
    }

    public PasswordValidationResult Validate(string password, string policyId = "Default")
    {
        if (!_policies.TryGetValue(policyId, out var policy))
        {
            policy = _policies["Default"];
        }

        var result = new PasswordValidationResult();

        if (string.IsNullOrEmpty(password))
        {
            result.IsValid = false;
            result.FailedRuleMessages.Add("Password is required.");
            return result;
        }

        if (password.Length < policy.MinimumLength)
        {
            result.FailedRuleMessages.Add($"Password must be at least {policy.MinimumLength} characters long.");
        }

        if (policy.RequireUppercase && !Regex.IsMatch(password, "[A-Z]"))
        {
            result.FailedRuleMessages.Add("Password must contain at least one uppercase letter.");
        }

        if (policy.RequireLowercase && !Regex.IsMatch(password, "[a-z]"))
        {
            result.FailedRuleMessages.Add("Password must contain at least one lowercase letter.");
        }

        if (policy.RequireDigit && !Regex.IsMatch(password, @"\d"))
        {
            result.FailedRuleMessages.Add("Password must contain at least one digit.");
        }

        if (policy.RequireSpecialCharacter)
        {
            var pattern = string.IsNullOrEmpty(policy.SpecialCharacterPattern)
                ? @"[@$!%*?&#^()_\-+=\[\]{}|\\:;""'<>,.?/~`]"
                : policy.SpecialCharacterPattern;

            if (!Regex.IsMatch(password, pattern))
            {
                result.FailedRuleMessages.Add("Password must contain at least one special character.");
            }
        }

        result.IsValid = result.FailedRuleMessages.Count == 0;
        return result;
    }

    public Task ValidateAndThrowAsync(string password, string policyId = "Default")
    {
        var result = Validate(password, policyId);
        if (!result.IsValid)
        {
            var errors = new Dictionary<string, string[]>
            {
                { "password", result.FailedRuleMessages.ToArray() }
            };
            throw new PasswordPolicyViolationException(errors, string.Join(" ", result.FailedRuleMessages));
        }

        return Task.CompletedTask;
    }
}
