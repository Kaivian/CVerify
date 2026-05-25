using System.Collections.Generic;

namespace CVerify.API.Application.Exceptions;

public class OtpPolicyViolationException : CVerifyBaseException
{
    public OtpPolicyViolationException(Dictionary<string, string[]> validationErrors, string defaultMessage = "OTP policy violation.") 
        : base("AUTH_OTP_VIOLATION", ErrorCategory.VALIDATION, "auth.validation.otp_policy_failed", defaultMessage)
    {
        DisplayMode = "Inline";
        ValidationErrors = validationErrors;
    }
}
