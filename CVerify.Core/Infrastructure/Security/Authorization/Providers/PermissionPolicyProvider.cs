using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using CVerify.API.Infrastructure.Security.Authorization.Requirements;

namespace CVerify.API.Infrastructure.Security.Authorization.Providers;

public class PermissionPolicyProvider : DefaultAuthorizationPolicyProvider
{
    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : base(options)
    {
    }

    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        // Check if policy already exists (e.g. [Authorize(Policy = "Role")])
        var policy = await base.GetPolicyAsync(policyName);
        if (policy != null) return policy;

        // If not, dynamically create a policy based on PermissionRequirement
        return new AuthorizationPolicyBuilder()
            .AddRequirements(new PermissionRequirement(policyName))
            .Build();
    }
}
