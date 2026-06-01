using System.Collections.Generic;

namespace CVerify.API.Modules.Shared.Exceptions;

public class PasswordPolicyViolationException : CVerifyBaseException
{
    public PasswordPolicyViolationException(Dictionary<string, string[]> validationErrors, string defaultMessage = "Password policy violation.") 
        : base("AUTH_PASSWORD_POLICY_VIOLATION", ErrorCategory.VALIDATION, "auth.validation.password_policy_failed", defaultMessage)
    {
        DisplayMode = "Inline";
        ValidationErrors = validationErrors;
    }
}
