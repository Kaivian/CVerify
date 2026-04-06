using System.Threading.Tasks;

namespace CVerify.API.Application.Security.PasswordPolicies;

public interface IPasswordPolicyService
{
    PasswordValidationResult Validate(string password, string policyId = "Default");
    Task ValidateAndThrowAsync(string password, string policyId = "Default");
}
