using System.Collections.Generic;

namespace CVerify.API.Modules.Auth.Services.PasswordPolicies;

public class PasswordValidationResult
{
    public bool IsValid { get; set; }
    public List<string> FailedRuleMessages { get; set; } = new();
}
