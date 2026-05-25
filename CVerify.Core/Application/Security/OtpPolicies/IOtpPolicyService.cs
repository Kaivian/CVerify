namespace CVerify.API.Application.Security.OtpPolicies;

public interface IOtpPolicyService
{
    bool Validate(string code, string policyId = "Default");
    void ValidateAndThrow(string code, string policyId = "Default");
}
