namespace CVerify.API.Modules.Auth.Services.OtpPolicies;

public interface IOtpPolicyService
{
    bool Validate(string code, string policyId = "Default");
    void ValidateAndThrow(string code, string policyId = "Default");
    OtpPolicyDefinition GetPolicy(string policyId = "Default");
}
