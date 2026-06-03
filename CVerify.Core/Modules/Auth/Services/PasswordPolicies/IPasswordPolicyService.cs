using System.Threading.Tasks;

namespace CVerify.API.Modules.Auth.Services.PasswordPolicies;

public interface IPasswordPolicyService
{
    PasswordValidationResult Validate(string password, string policyId = "Default");
    Task ValidateAndThrowAsync(string password, string policyId = "Default");
}
